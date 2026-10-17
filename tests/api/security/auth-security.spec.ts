import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import { expect, test } from '@fixtures/base.fixture';

const claims = { id: 1, email: env.USER_EMAIL, name: 'Test User', role: 'user' };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

test.describe('Token security', () => {
  test('a token signed with the right secret works (control)', async ({ rest }) => {
    const token = jwt.sign(claims, env.JWT_SECRET, { expiresIn: '5m' });
    expect((await rest.get('/api/auth/me', { token })).status()).toBe(200);
  });

  test('an expired token is rejected', async ({ rest }) => {
    const token = jwt.sign(claims, env.JWT_SECRET, { expiresIn: -60 });
    expect((await rest.get('/api/auth/me', { token })).status()).toBe(401);
  });

  test('a token signed with another secret is rejected', async ({ rest }) => {
    const token = jwt.sign({ ...claims, role: 'admin' }, 'attacker-secret', { expiresIn: '5m' });
    expect((await rest.get('/api/auth/me', { token })).status()).toBe(401);
  });

  test('a user token with the role edited to admin (signature not recomputed) is rejected', async ({
    rest,
    userServices,
  }) => {
    const [header, , signature] = userServices.session.token.split('.');
    const forged = `${header}.${b64({ ...userServices.session.user, role: 'admin' })}.${signature}`;
    expect((await rest.post('/api/products', { token: forged, data: { name: 'x', price: 1 } })).status()).toBe(401);
  });

  test('an unsigned (alg=none) token is rejected', async ({ rest }) => {
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, role: 'admin' })}.`;
    expect((await rest.get('/api/auth/me', { token })).status()).toBe(401);
  });

  test('the wrong authorization scheme is rejected', async ({ rest, userServices }) => {
    const res = await rest.get('/api/auth/me', { headers: { Authorization: `Basic ${userServices.session.token}` } });
    expect(res.status()).toBe(401);
  });

  test('an admin-only endpoint refuses a valid user token (privilege escalation)', async ({
    rest,
    userServices,
    makeProduct,
  }) => {
    const p = await makeProduct();
    const res = await rest.patch(`/api/products/${p.id}`, { token: userServices.session.token, data: { price: 0 } });
    expect(res.status()).toBe(403);
  });
});

test.describe('Input handling', () => {
  test('SQL injection in the search parameter is treated as plain text', async ({ rest }) => {
    for (const payload of [`' OR '1'='1`, `'; DROP TABLE products; --`, `" OR ""="`]) {
      const res = await rest.get('/api/products', { params: { search: payload } });
      expect(res.status(), payload).toBe(200);
      expect(await res.json(), payload).toEqual([]);
    }
    // The table must still be intact.
    expect((await (await rest.get('/api/products')).json()).length).toBeGreaterThanOrEqual(6);
  });

  test('SQL injection in the login form does not authenticate', async ({ rest }) => {
    const res = await rest.post('/api/auth/login', { data: { email: `' OR 1=1 --`, password: `' OR '1'='1` } });
    expect(res.status()).toBe(401);
  });

  test('mass assignment: an id in the PATCH body does not change the product id', async ({
    rest,
    adminServices,
    makeProduct,
  }) => {
    const p = await makeProduct();
    const res = await rest.patch(`/api/products/${p.id}`, {
      token: adminServices.session.token,
      data: { id: 999999, price: 3 },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).id).toBe(p.id);
  });

  test('a role in the login body is ignored', async ({ rest }) => {
    const res = await rest.post('/api/auth/login', {
      data: { email: env.USER_EMAIL, password: env.USER_PASSWORD, role: 'admin' },
    });
    expect((await res.json()).user.role).toBe('user');
  });
});

test.describe('HTTP hardening', () => {
  test('responses carry basic security headers and hide the framework', async ({ rest }) => {
    const res = await rest.get('/api/products');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['x-powered-by']).toBeUndefined();
  });

  test('error responses do not leak stack traces', async ({ rest }) => {
    const res = await rest.get('/api/products/abc');
    expect(await res.text()).not.toMatch(/at .*\.(ts|js):\d+/);
  });
});

test.describe('Brute-force protection (opt-in via X-Client-Id)', () => {
  const clientId = () => `rate-limit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const attempt = (rest: any, id: string, password: string) =>
    rest.post('/api/auth/login', { headers: { 'X-Client-Id': id }, data: { email: env.USER_EMAIL, password } });

  test('the 6th failed login in a minute is rate limited, even with the right password', async ({ rest }) => {
    const id = clientId();
    for (let i = 0; i < 5; i++) expect((await attempt(rest, id, 'wrong')).status()).toBe(401);

    const blocked = await attempt(rest, id, env.USER_PASSWORD);
    expect(blocked.status()).toBe(429);
    expect(blocked.headers()['retry-after']).toBe('60');
  });

  test('a successful login resets the failure counter', async ({ rest }) => {
    const id = clientId();
    for (let i = 0; i < 4; i++) await attempt(rest, id, 'wrong');
    expect((await attempt(rest, id, env.USER_PASSWORD)).status()).toBe(200);
    for (let i = 0; i < 5; i++) expect((await attempt(rest, id, 'wrong')).status()).toBe(401);
  });

  test('limits are per client: another client id is unaffected', async ({ rest }) => {
    const noisy = clientId();
    for (let i = 0; i < 5; i++) await attempt(rest, noisy, 'wrong');
    expect((await attempt(rest, noisy, env.USER_PASSWORD)).status()).toBe(429);
    expect((await attempt(rest, clientId(), env.USER_PASSWORD)).status()).toBe(200);
  });
});
