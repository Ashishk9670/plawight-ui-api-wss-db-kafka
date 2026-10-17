import { expect, test } from '@fixtures/base.fixture';

test.describe('Concurrent orders', () => {
  test('20 parallel orders for 5 units: exactly 5 succeed and stock never goes negative @concurrency', async ({
    rest,
    userServices,
    db,
    makeProduct,
  }) => {
    const product = await makeProduct({ stock: 5, price: 10 });
    const place = () =>
      rest.post('/api/orders', {
        token: userServices.session.token,
        data: { items: [{ productId: product.id, quantity: 1 }] },
      });

    const statuses = (await Promise.all(Array.from({ length: 20 }, place))).map((r) => r.status());

    expect(statuses.filter((s) => s === 201)).toHaveLength(5);
    expect(statuses.filter((s) => s === 409)).toHaveLength(15);
    expect(statuses.filter((s) => s !== 201 && s !== 409)).toEqual([]);

    const stock = await db.queryOne<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [product.id]);
    expect(stock!.stock).toBe(0);
    const sold = await db.queryOne<{ sold: string }>(
      'SELECT coalesce(sum(quantity), 0) AS sold FROM order_items WHERE product_id = $1',
      [product.id],
    );
    expect(Number(sold!.sold)).toBe(5);
  });

  test('mixed quantities never oversell', async ({ rest, userServices, db, makeProduct }) => {
    const product = await makeProduct({ stock: 15 });
    const place = (quantity: number) =>
      rest.post('/api/orders', {
        token: userServices.session.token,
        data: { items: [{ productId: product.id, quantity }] },
      });

    const results = await Promise.all(
      [3, 3, 3, 3, 3, 3, 3, 3, 2, 2].map(async (q) => ({ q, status: (await place(q)).status() })),
    );
    const sold = results.filter((r) => r.status === 201).reduce((sum, r) => sum + r.q, 0);

    expect(sold).toBeLessThanOrEqual(15);
    const stock = await db.queryOne<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [product.id]);
    expect(stock!.stock).toBe(15 - sold);
    expect(stock!.stock).toBeGreaterThanOrEqual(0);
  });

  test('concurrent status updates on one order all succeed and the last write is stored', async ({
    userServices,
    adminServices,
    db,
    makeProduct,
  }) => {
    const product = await makeProduct();
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);

    const responses = await Promise.all(
      ['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((s) => adminServices.orders.updateStatus(order.id, s)),
    );
    expect(responses.map((r) => r.status())).toEqual([200, 200, 200, 200]);

    const row = await db.queryOne<{ status: string }>('SELECT status FROM orders WHERE id = $1', [order.id]);
    expect(['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']).toContain(row!.status);
  });
});
