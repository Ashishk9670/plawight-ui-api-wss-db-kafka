import { expect, test } from '@fixtures/base.fixture';

interface OrderRow {
  id: number;
  user_id: number;
  status: string;
  total: string;
}
interface ItemRow {
  product_id: number;
  quantity: number;
  unit_price: string;
}

test.describe('Database validation', () => {
  test('seed data is present @smoke @db', async ({ db }) => {
    const [{ count }] = await db.query<{ count: string }>('SELECT count(*) FROM products WHERE category <> $1', [
      'test',
    ]);
    expect(Number(count)).toBeGreaterThanOrEqual(6);
    const users = await db.query<{ email: string; role: string }>('SELECT email, role FROM users ORDER BY id');
    expect(users).toEqual(
      expect.arrayContaining([
        { email: 'user@shop.test', role: 'user' },
        { email: 'admin@shop.test', role: 'admin' },
      ]),
    );
  });

  test('passwords are not stored in clear text', async ({ db }) => {
    const user = await db.queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE email = $1', [
      'user@shop.test',
    ]);
    expect(user!.password_hash).not.toContain('Password123!');
    expect(user!.password_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('POST /api/orders persists the order and its items', async ({ db, userServices, makeProduct }) => {
    const product = await makeProduct({ price: 7.5, stock: 20 });
    const order = await userServices.orders.create([{ productId: product.id, quantity: 4 }]);

    const row = await db.queryOne<OrderRow>('SELECT * FROM orders WHERE id = $1', [order.id]);
    expect(row).toMatchObject({ id: order.id, user_id: userServices.session.user.id, status: 'CREATED' });
    expect(Number(row!.total)).toBe(order.total);
    expect(Number(row!.total)).toBe(30);

    const items = await db.query<ItemRow>('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ product_id: product.id, quantity: 4 });
    expect(Number(items[0].unit_price)).toBe(7.5);
  });

  test('stock is decremented in the database', async ({ db, userServices, makeProduct }) => {
    const product = await makeProduct({ stock: 10 });
    await userServices.orders.create([{ productId: product.id, quantity: 3 }]);
    const row = await db.queryOne<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [product.id]);
    expect(row!.stock).toBe(7);
  });

  test('a rejected order rolls back completely', async ({ db, rest, userServices, makeProduct }) => {
    const product = await makeProduct({ stock: 2 });
    const res = await rest.post('/api/orders', {
      token: userServices.session.token,
      data: { items: [{ productId: product.id, quantity: 5 }] },
    });
    expect(res.status()).toBe(409);

    const [{ count }] = await db.query<{ count: string }>('SELECT count(*) FROM order_items WHERE product_id = $1', [
      product.id,
    ]);
    expect(Number(count)).toBe(0);
    expect(
      (await db.queryOne<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [product.id]))!.stock,
    ).toBe(2);
  });

  test('a multi-item order that fails midway leaves no partial data', async ({
    db,
    rest,
    userServices,
    makeProduct,
  }) => {
    const ok = await makeProduct({ stock: 10 });
    const scarce = await makeProduct({ stock: 1 });
    const res = await rest.post('/api/orders', {
      token: userServices.session.token,
      data: {
        items: [
          { productId: ok.id, quantity: 2 },
          { productId: scarce.id, quantity: 3 },
        ],
      },
    });
    expect(res.status()).toBe(409);
    // The first item's stock change must have been rolled back with the failed transaction.
    expect((await db.queryOne<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [ok.id]))!.stock).toBe(10);
  });

  test('status changes made through the API are persisted', async ({
    db,
    userServices,
    adminServices,
    makeProduct,
  }) => {
    const product = await makeProduct();
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
    await adminServices.orders.updateStatus(order.id, 'DELIVERED');
    await expect
      .poll(async () => (await db.queryOne<OrderRow>('SELECT status FROM orders WHERE id = $1', [order.id]))?.status)
      .toBe('DELIVERED');
  });

  test('API order total matches the sum of persisted line items', async ({ db, userServices, makeProduct }) => {
    const a = await makeProduct({ price: 3.33, stock: 50 });
    const b = await makeProduct({ price: 11.1, stock: 50 });
    const order = await userServices.orders.create([
      { productId: a.id, quantity: 3 },
      { productId: b.id, quantity: 2 },
    ]);
    const [{ sum }] = await db.query<{ sum: string }>(
      'SELECT sum(quantity * unit_price) AS sum FROM order_items WHERE order_id = $1',
      [order.id],
    );
    expect(Number(sum)).toBeCloseTo(order.total, 2);
  });

  test('deleting a product removes its row; one referenced by an order cannot be deleted', async ({
    db,
    adminServices,
    userServices,
    makeProduct,
  }) => {
    const free = await makeProduct();
    expect((await adminServices.products.remove(free.id)).status()).toBe(204);
    expect(await db.queryOne('SELECT 1 FROM products WHERE id = $1', [free.id])).toBeUndefined();

    const used = await makeProduct();
    await userServices.orders.create([{ productId: used.id, quantity: 1 }]);
    expect((await adminServices.products.remove(used.id)).status()).toBe(409);
    expect(await db.queryOne('SELECT 1 FROM products WHERE id = $1', [used.id])).toBeDefined();
  });
});
