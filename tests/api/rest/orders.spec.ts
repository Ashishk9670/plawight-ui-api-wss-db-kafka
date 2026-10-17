import { OrderSchema } from '@schemas';
import { expect, test } from '@fixtures/base.fixture';
import { validate } from '@utils/schema-validator';

test.describe('REST /api/orders', () => {
  test('creates an order, computes the total and matches the schema @smoke @api', async ({
    userServices,
    makeProduct,
  }) => {
    const product = await makeProduct({ price: 20, stock: 10 });
    const order = validate(OrderSchema, await userServices.orders.create([{ productId: product.id, quantity: 3 }]));
    expect(order.status).toBe('CREATED');
    expect(order.total).toBe(60);
    expect(order.userId).toBe(userServices.session.user.id);
    expect(order.items).toEqual([{ productId: product.id, name: product.name, quantity: 3, unitPrice: 20 }]);
  });

  test('order creation decrements stock', async ({ userServices, rest, makeProduct }) => {
    const product = await makeProduct({ stock: 10 });
    await userServices.orders.create([{ productId: product.id, quantity: 4 }]);
    const after = await (await rest.get(`/api/products/${product.id}`)).json();
    expect(after.stock).toBe(6);
  });

  test('chain: create -> get -> ship -> get', async ({ userServices, adminServices, makeProduct }) => {
    const product = await makeProduct();
    const created = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);

    const fetched = await userServices.orders.get(created.id);
    expect(fetched).toEqual(created);

    expect((await adminServices.orders.updateStatus(created.id, 'SHIPPED')).status()).toBe(200);
    expect((await userServices.orders.get(created.id)).status).toBe('SHIPPED');
  });

  test('rejects an empty order with 400', async ({ rest, userServices }) => {
    const res = await rest.post('/api/orders', { token: userServices.session.token, data: { items: [] } });
    expect(res.status()).toBe(400);
  });

  test('rejects quantity 0 with 400', async ({ rest, userServices, makeProduct }) => {
    const product = await makeProduct();
    const res = await rest.post('/api/orders', {
      token: userServices.session.token,
      data: { items: [{ productId: product.id, quantity: 0 }] },
    });
    expect(res.status()).toBe(400);
  });

  test('unknown product is 404', async ({ rest, userServices }) => {
    const res = await rest.post('/api/orders', {
      token: userServices.session.token,
      data: { items: [{ productId: 99999999, quantity: 1 }] },
    });
    expect(res.status()).toBe(404);
  });

  test('insufficient stock is 409 and stock is untouched', async ({ rest, userServices, makeProduct }) => {
    const product = await makeProduct({ stock: 2 });
    const res = await rest.post('/api/orders', {
      token: userServices.session.token,
      data: { items: [{ productId: product.id, quantity: 5 }] },
    });
    expect(res.status()).toBe(409);
    expect((await (await rest.get(`/api/products/${product.id}`)).json()).stock).toBe(2);
  });

  test('creating an order without a token is 401', async ({ rest }) => {
    const res = await rest.post('/api/orders', { data: { items: [{ productId: 1, quantity: 1 }] } });
    expect(res.status()).toBe(401);
  });

  test("a user cannot read another user's order (404)", async ({ rest, adminServices, userServices, makeProduct }) => {
    const product = await makeProduct();
    const adminOrder = await adminServices.orders.create([{ productId: product.id, quantity: 1 }]);
    const res = await rest.get(`/api/orders/${adminOrder.id}`, { token: userServices.session.token });
    expect(res.status()).toBe(404);
  });

  test("the order list only contains the caller's orders", async ({
    rest,
    userServices,
    adminServices,
    makeProduct,
  }) => {
    const product = await makeProduct();
    const mine = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
    const theirs = await adminServices.orders.create([{ productId: product.id, quantity: 1 }]);
    const list = await (await rest.get('/api/orders', { token: userServices.session.token })).json();
    const ids = list.map((o: { id: number }) => o.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });

  test('regular user cannot change order status (403)', async ({ userServices, makeProduct }) => {
    const product = await makeProduct();
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
    expect((await userServices.orders.updateStatus(order.id, 'PAID')).status()).toBe(403);
  });

  test('invalid status value is 400', async ({ userServices, adminServices, makeProduct }) => {
    const product = await makeProduct();
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
    expect((await adminServices.orders.updateStatus(order.id, 'TELEPORTED')).status()).toBe(400);
  });
});
