import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requireAdmin, requireAuth, signToken, hashPassword } from './auth.js';
import { HttpError, pool, seedUsers, waitForDb } from './db.js';
import { graphqlHandler } from './graphql.js';
import { initKafka } from './kafka.js';
import * as orders from './orders.js';
import { testApi } from './test-api.js';
import { attachWebSocket } from './ws.js';

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// GraphQL must see the raw body, so it is mounted before express.json().
app.all('/graphql', graphqlHandler);
app.use(express.json());

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const intParam = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, 'id must be an integer');
  return n;
};

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const here = path.dirname(fileURLToPath(import.meta.url));
app.get('/openapi.json', (_req, res) => res.sendFile(path.join(here, '../openapi.json')));
if (process.env.ENABLE_TEST_API === 'true') app.use('/api/test', testApi);

// ---- auth ----
// Opt-in brute-force protection: clients that send an X-Client-Id header get 5 failed logins per minute.
// Requests without the header are not limited, so ordinary test traffic is unaffected.
const FAILED_LOGIN_LIMIT = 5;
const FAILED_LOGIN_WINDOW_MS = 60_000;
const failedLogins = new Map<string, number[]>();

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const clientId = req.header('x-client-id');
    const recent = clientId
      ? (failedLogins.get(clientId) ?? []).filter((t) => Date.now() - t < FAILED_LOGIN_WINDOW_MS)
      : [];
    if (clientId && recent.length >= FAILED_LOGIN_LIMIT) {
      res.setHeader('Retry-After', '60');
      throw new HttpError(429, 'Too many failed login attempts');
    }
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new HttpError(400, 'email and password are required');
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows[0] || rows[0].password_hash !== hashPassword(password)) {
      if (clientId) failedLogins.set(clientId, [...recent, Date.now()]);
      throw new HttpError(401, 'Invalid credentials');
    }
    if (clientId) failedLogins.delete(clientId);
    const user = { id: rows[0].id, email: rows[0].email, name: rows[0].name, role: rows[0].role };
    res.json({ token: signToken(user), user });
  }),
);

app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user));

// ---- products ----
app.get(
  '/api/products',
  wrap(async (req, res) => {
    res.json(await orders.listProducts(req.query.search as string, req.query.category as string));
  }),
);
app.get(
  '/api/products/:id',
  wrap(async (req, res) => {
    const p = await orders.getProduct(intParam(req.params.id));
    if (!p) throw new HttpError(404, 'Product not found');
    res.json(p);
  }),
);
app.post(
  '/api/products',
  requireAuth,
  requireAdmin,
  wrap(async (req, res) => {
    res.status(201).json(await orders.createProduct(req.body ?? {}));
  }),
);
app.put(
  '/api/products/:id',
  requireAuth,
  requireAdmin,
  wrap(async (req, res) => {
    res.json(await orders.updateProduct(intParam(req.params.id), req.body ?? {}));
  }),
);
app.patch(
  '/api/products/:id',
  requireAuth,
  requireAdmin,
  wrap(async (req, res) => {
    res.json(await orders.updateProduct(intParam(req.params.id), req.body ?? {}));
  }),
);
app.delete(
  '/api/products/:id',
  requireAuth,
  requireAdmin,
  wrap(async (req, res) => {
    await orders.deleteProduct(intParam(req.params.id));
    res.status(204).end();
  }),
);

// ---- orders ----
app.get(
  '/api/orders',
  requireAuth,
  wrap(async (req, res) => {
    res.json(await orders.listOrders(req.user!.id, req.user!.role === 'admin'));
  }),
);
app.get(
  '/api/orders/:id',
  requireAuth,
  wrap(async (req, res) => {
    const o = await orders.getOrder(intParam(req.params.id));
    if (!o || (req.user!.role !== 'admin' && o.userId !== req.user!.id)) throw new HttpError(404, 'Order not found');
    res.json(o);
  }),
);
app.post(
  '/api/orders',
  requireAuth,
  wrap(async (req, res) => {
    res.status(201).json(await orders.createOrder(req.user!.id, req.body?.items));
  }),
);
app.patch(
  '/api/orders/:id/status',
  requireAuth,
  requireAdmin,
  wrap(async (req, res) => {
    res.json(await orders.updateOrderStatus(intParam(req.params.id), req.body?.status));
  }),
);

// ---- frontend ----
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await waitForDb();
  await seedUsers();
  await initKafka();
  const server = http.createServer(app);
  attachWebSocket(server);
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`AUT listening on :${port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
