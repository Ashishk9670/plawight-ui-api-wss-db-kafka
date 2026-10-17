import { Router } from 'express';
import { requireAdmin, requireAuth } from './auth.js';
import { HttpError, pool } from './db.js';
import { createProduct, getOrder, type Order } from './orders.js';

/**
 * Test-support endpoints, mounted only when ENABLE_TEST_API=true (never in a real deployment).
 * They let automated tests set up state directly: no UI clicks, no raw SQL, and no Kafka/WebSocket noise.
 */
export const testApi = Router();
testApi.use(requireAuth, requireAdmin);

testApi.post('/seed/products', async (req, res, next) => {
  try {
    const list = req.body?.products;
    if (!Array.isArray(list)) throw new HttpError(400, 'products must be an array');
    const created = [];
    for (const p of list) created.push(await createProduct(p));
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

/** Inserts orders in any status. Stock is decremented; no events are published. */
testApi.post('/seed/orders', async (req, res, next) => {
  try {
    const list = req.body?.orders;
    if (!Array.isArray(list)) throw new HttpError(400, 'orders must be an array');
    const created: Order[] = [];
    for (const o of list as {
      userEmail: string;
      status?: string;
      items: { productId: number; quantity: number }[];
    }[]) {
      const user = await pool.query('SELECT id FROM users WHERE email = $1', [o.userEmail]);
      if (!user.rows[0]) throw new HttpError(404, `User ${o.userEmail} not found`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let total = 0;
        const lines: { productId: number; quantity: number; price: number }[] = [];
        for (const item of o.items) {
          const p = await client.query('SELECT price FROM products WHERE id = $1 FOR UPDATE', [item.productId]);
          if (!p.rows[0]) throw new HttpError(404, `Product ${item.productId} not found`);
          await client.query('UPDATE products SET stock = GREATEST(stock - $2, 0) WHERE id = $1', [
            item.productId,
            item.quantity,
          ]);
          lines.push({ ...item, price: Number(p.rows[0].price) });
          total += Number(p.rows[0].price) * item.quantity;
        }
        const ins = await client.query('INSERT INTO orders (user_id, status, total) VALUES ($1,$2,$3) RETURNING id', [
          user.rows[0].id,
          o.status ?? 'CREATED',
          total.toFixed(2),
        ]);
        for (const l of lines) {
          await client.query(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)',
            [ins.rows[0].id, l.productId, l.quantity, l.price],
          );
        }
        await client.query('COMMIT');
        created.push((await getOrder(ins.rows[0].id))!);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

/** Force-deletes a product together with any orders that reference it. */
testApi.delete('/products/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await pool.query('DELETE FROM orders WHERE id IN (SELECT order_id FROM order_items WHERE product_id = $1)', [id]);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
