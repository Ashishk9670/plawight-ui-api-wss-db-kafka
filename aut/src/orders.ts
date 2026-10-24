import { HttpError, pool } from './db.js';
import { publishOrderEvent } from './kafka.js';
import { notifyUser } from './ws.js';

export const ORDER_STATUSES = ['CREATED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItemInput {
  productId: number;
  quantity: number;
}

export interface Order {
  id: number;
  userId: number;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: { productId: number; name: string; quantity: number; unitPrice: number }[];
}

const mapProduct = (r: any) => ({
  id: r.id as number,
  name: r.name as string,
  description: r.description as string,
  category: r.category as string,
  price: Number(r.price),
  stock: r.stock as number,
});

export async function listProducts(search?: string, category?: string) {
  const { rows } = await pool.query(
    `SELECT * FROM products
     WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR category = $2)
     ORDER BY id`,
    [search || null, category || null],
  );
  return rows.map(mapProduct);
}

export async function getProduct(id: number) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function createProduct(p: {
  name: string;
  description?: string;
  category?: string;
  price: number;
  stock?: number;
}) {
  if (!p.name || typeof p.price !== 'number' || p.price < 0)
    throw new HttpError(400, 'name and a non-negative price are required');
  const { rows } = await pool.query(
    `INSERT INTO products (name, description, category, price, stock) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [p.name, p.description ?? '', p.category ?? 'general', p.price, p.stock ?? 0],
  );
  return mapProduct(rows[0]);
}

export async function updateProduct(
  id: number,
  p: Partial<{ name: string; description: string; category: string; price: number; stock: number }>,
) {
  const current = await getProduct(id);
  if (!current) throw new HttpError(404, 'Product not found');
  const m = { ...current, ...p };
  if (!m.name || m.price < 0 || m.stock < 0) throw new HttpError(400, 'Invalid product data');
  const { rows } = await pool.query(
    `UPDATE products SET name=$2, description=$3, category=$4, price=$5, stock=$6 WHERE id=$1 RETURNING *`,
    [id, m.name, m.description, m.category, m.price, m.stock],
  );
  return mapProduct(rows[0]);
}

export async function deleteProduct(id: number) {
  try {
    const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, 'Product not found');
  } catch (e: any) {
    if (e.code === '23503') throw new HttpError(409, 'Product is referenced by existing orders');
    throw e;
  }
}

export async function getOrder(id: number): Promise<Order | null> {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const items = await pool.query(
    `SELECT oi.product_id, p.name, oi.quantity, oi.unit_price
       FROM order_items oi JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1 ORDER BY oi.id`,
    [id],
  );
  return {
    id: rows[0].id,
    userId: rows[0].user_id,
    status: rows[0].status,
    total: Number(rows[0].total),
    createdAt: new Date(rows[0].created_at).toISOString(),
    items: items.rows.map((i) => ({
      productId: i.product_id,
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
    })),
  };
}

export async function listOrders(userId: number, isAdmin: boolean) {
  const { rows } = await pool.query(`SELECT id FROM orders WHERE ($1::boolean OR user_id = $2) ORDER BY id DESC`, [
    isAdmin,
    userId,
  ]);
  return (await Promise.all(rows.map((r) => getOrder(r.id)))) as Order[];
}

export async function createOrder(userId: number, items: OrderItemInput[]): Promise<Order> {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Order must contain at least one item');
  if (items.some((i) => !Number.isInteger(i.productId) || !Number.isInteger(i.quantity) || i.quantity < 1)) {
    throw new HttpError(400, 'Each item needs an integer productId and quantity >= 1');
  }

  const client = await pool.connect();
  let orderId: number;
  try {
    await client.query('BEGIN');
    let total = 0;
    const priced: { productId: number; quantity: number; price: number }[] = [];
    for (const item of items) {
      const { rows } = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [item.productId]);
      if (!rows[0]) throw new HttpError(404, `Product ${item.productId} not found`);
      if (rows[0].stock < item.quantity) throw new HttpError(409, `Insufficient stock for ${rows[0].name}`);
      await client.query('UPDATE products SET stock = stock - $2 WHERE id = $1', [item.productId, item.quantity]);
      priced.push({ ...item, price: Number(rows[0].price) });
      total += Number(rows[0].price) * item.quantity;
    }
    const created = await client.query('INSERT INTO orders (user_id, status, total) VALUES ($1, $2, $3) RETURNING id', [
      userId,
      'CREATED',
      total.toFixed(2),
    ]);
    orderId = created.rows[0].id;
    for (const p of priced) {
      await client.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)', [
        orderId,
        p.productId,
        p.quantity,
        p.price,
      ]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const order = (await getOrder(orderId))!;
  try {
    await publishOrderEvent('order.created', order);
  } catch (e) {
    // The order must not exist without its event: compensate, so the caller can safely retry.
    console.error(`Publishing order.created for order ${order.id} failed, rolling the order back`, e);
    await undoOrder(order);
    throw new HttpError(503, 'Event bus unavailable, the order was not placed');
  }
  notifyUser(userId, { type: 'order.status', orderId: order.id, status: order.status });
  return order;
}

/** Compensation for a committed order: puts the stock back and removes the order and its items. */
async function undoOrder(order: Order): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of order.items) {
      await client.query('UPDATE products SET stock = stock + $2 WHERE id = $1', [item.productId, item.quantity]);
    }
    await client.query('DELETE FROM orders WHERE id = $1', [order.id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(id: number, status: string): Promise<Order> {
  if (!ORDER_STATUSES.includes(status as OrderStatus))
    throw new HttpError(400, `status must be one of ${ORDER_STATUSES.join(', ')}`);
  const previous = await pool.query('SELECT status FROM orders WHERE id = $1', [id]);
  if (!previous.rows[0]) throw new HttpError(404, 'Order not found');
  await pool.query('UPDATE orders SET status = $2 WHERE id = $1', [id, status]);
  const order = (await getOrder(id))!;
  try {
    await publishOrderEvent('order.updated', order);
  } catch (e) {
    console.error(`Publishing order.updated for order ${id} failed, reverting the status`, e);
    // Only revert if nobody changed the status in the meantime.
    await pool.query('UPDATE orders SET status = $3 WHERE id = $1 AND status = $2', [
      id,
      status,
      previous.rows[0].status,
    ]);
    throw new HttpError(503, 'Event bus unavailable, the status was not changed');
  }
  notifyUser(order.userId, { type: 'order.status', orderId: order.id, status: order.status });
  return order;
}
