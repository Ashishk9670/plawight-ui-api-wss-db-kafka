import { CREATE_ORDER, ORDER, ORDERS, UPDATE_ORDER_STATUS } from '@clients/graphql-operations';
import { OrderSchema } from '@schemas';
import type { Order } from '@schemas/graphql.generated';
import { expect, test } from '@fixtures/base.fixture';
import { validate } from '@utils/schema-validator';

test.describe('GraphQL orders', () => {
  test('createOrder mutation creates an order @smoke @graphql', async ({ userGraphql, makeProduct }) => {
    const product = await makeProduct({ price: 15, stock: 10 });
    const { data, errors } = await userGraphql.execute<{ createOrder: Order }>(CREATE_ORDER, {
      items: [{ productId: product.id, quantity: 2 }],
    });
    expect(errors).toBeUndefined();
    const order = validate(OrderSchema, data!.createOrder);
    expect(order).toMatchObject({ status: 'CREATED', total: 30 });
  });

  test("orders query returns the caller's orders; order(id) returns one", async ({
    userGraphql,
    userServices,
    makeProduct,
  }) => {
    const product = await makeProduct();
    const created = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);

    const list = await userGraphql.execute<{ orders: Order[] }>(ORDERS);
    expect(list.data!.orders.map((o) => o.id)).toContain(created.id);

    const one = await userGraphql.execute<{ order: Order }>(ORDER, { id: created.id });
    expect(one.data!.order).toEqual(created);
  });

  test("order(id) of another user's order is null", async ({ userGraphql, adminServices, makeProduct }) => {
    const product = await makeProduct();
    const adminOrder = await adminServices.orders.create([{ productId: product.id, quantity: 1 }]);
    const { data, errors } = await userGraphql.execute<{ order: Order | null }>(ORDER, { id: adminOrder.id });
    expect(errors).toBeUndefined();
    expect(data!.order).toBeNull();
  });

  test('admin updateOrderStatus is visible through REST', async ({ adminGraphql, userServices, makeProduct }) => {
    const product = await makeProduct();
    const created = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
    const { data, errors } = await adminGraphql.execute<{ updateOrderStatus: Order }>(UPDATE_ORDER_STATUS, {
      id: created.id,
      status: 'PAID',
    });
    expect(errors).toBeUndefined();
    expect(data!.updateOrderStatus.status).toBe('PAID');
    expect((await userServices.orders.get(created.id)).status).toBe('PAID');
  });

  test('orders without a token returns UNAUTHENTICATED', async ({ graphql }) => {
    const { data, errors } = await graphql.execute(ORDERS);
    expect(data).toBeNull();
    expect(errors![0]).toMatchObject({ message: 'Unauthorized', extensions: { code: 'UNAUTHENTICATED' } });
  });

  test('a regular user calling updateOrderStatus gets FORBIDDEN', async ({
    userGraphql,
    userServices,
    makeProduct,
  }) => {
    const product = await makeProduct();
    const created = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
    const { errors } = await userGraphql.execute(UPDATE_ORDER_STATUS, { id: created.id, status: 'PAID' });
    expect(errors![0].extensions).toMatchObject({ code: 'FORBIDDEN' });
  });

  test('createOrder with insufficient stock returns a 409 error and no order', async ({ userGraphql, makeProduct }) => {
    const product = await makeProduct({ stock: 1 });
    const { data, errors } = await userGraphql.execute(CREATE_ORDER, {
      items: [{ productId: product.id, quantity: 9 }],
    });
    expect(data).toBeNull();
    expect(errors![0]).toMatchObject({
      message: expect.stringContaining('Insufficient stock'),
      extensions: { code: '409' },
    });
  });

  test('createOrder for an unknown product returns a 404 error', async ({ userGraphql }) => {
    const { errors } = await userGraphql.execute(CREATE_ORDER, { items: [{ productId: 99999999, quantity: 1 }] });
    expect(errors![0].extensions).toMatchObject({ code: '404' });
  });

  test('updateOrderStatus with an invalid status returns a 400 error', async ({
    adminGraphql,
    userServices,
    makeProduct,
  }) => {
    const product = await makeProduct();
    const created = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
    const { errors } = await adminGraphql.execute(UPDATE_ORDER_STATUS, { id: created.id, status: 'NOPE' });
    expect(errors![0].extensions).toMatchObject({ code: '400' });
  });
});
