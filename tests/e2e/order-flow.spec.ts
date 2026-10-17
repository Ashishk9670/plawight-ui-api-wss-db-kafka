import { CREATE_ORDER, ORDER, UPDATE_ORDER_STATUS } from '@clients/graphql-operations';
import { OrderEventSchema, OrderSchema, WsOrderStatusSchema } from '@schemas';
import { expect, test } from '@fixtures/base.fixture';
import { validate } from '@utils/schema-validator';

/**
 * UI -> REST / GraphQL -> Database -> Kafka / WebSocket -> UI
 * One business transaction verified at every layer.
 */
test.describe('E2E order lifecycle', () => {
  test('order placed in the UI is consistent across every layer @e2e @smoke', async ({
    shopPage,
    userServices,
    userGraphql,
    adminGraphql,
    userSocket,
    kafka,
    db,
    makeProduct,
  }) => {
    const productName = `E2E Widget ${Date.now()}`;
    const product = await makeProduct({ name: productName, price: 19.99, stock: 25 });
    const listener = await kafka.listen();

    try {
      // 1. UI: place the order
      const orderId = await test.step('UI: search, add to cart twice, place order', async () => {
        await shopPage.open();
        await shopPage.searchFor(productName);
        await shopPage.addToCart(productName, 2);
        await shopPage.expectCartTotal('39.98');
        return shopPage.submitOrderAndGetId();
      });

      await shopPage.expectOrder(orderId, { status: 'CREATED', total: '39.98' });

      // 2. REST
      await test.step('REST: order exists with the right content', async () => {
        const order = validate(OrderSchema, await userServices.orders.get(orderId));
        expect(order).toMatchObject({ status: 'CREATED', total: 39.98, userId: userServices.session.user.id });
        expect(order.items).toEqual([{ productId: product.id, name: productName, quantity: 2, unitPrice: 19.99 }]);
      });

      // 3. GraphQL returns the same record
      await test.step('GraphQL: order(id) equals the REST order', async () => {
        const { data } = await userGraphql.execute<{ order: unknown }>(ORDER, { id: orderId });
        expect(data!.order).toEqual(await userServices.orders.get(orderId));
      });

      // 4. Database
      await test.step('DB: order row, item row and stock', async () => {
        const row = await db.queryOne<{ status: string; total: string }>(
          'SELECT status, total FROM orders WHERE id = $1',
          [orderId],
        );
        expect(row).toMatchObject({ status: 'CREATED' });
        expect(Number(row!.total)).toBe(39.98);
        const items = await db.query<{ quantity: number }>('SELECT quantity FROM order_items WHERE order_id = $1', [
          orderId,
        ]);
        expect(items.map((i) => i.quantity)).toEqual([2]);
        const stock = await db.queryOne<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [product.id]);
        expect(stock!.stock).toBe(23);
      });

      // 5. Kafka
      await test.step('Kafka: order.created event', async () => {
        const event = await listener.waitForEvent(
          (e) => e.value?.order?.id === orderId && e.value.eventType === 'order.created',
        );
        expect(validate(OrderEventSchema, event.value).order.total).toBe(39.98);
      });

      // 6. WebSocket
      await test.step('WebSocket: CREATED push', async () => {
        const msg = await userSocket.waitForMessage((m) => m.orderId === orderId && m.status === 'CREATED');
        validate(WsOrderStatusSchema, msg);
      });

      // 7. Admin ships the order via GraphQL; every layer follows
      await test.step('GraphQL (admin): ship the order', async () => {
        const { errors, data } = await adminGraphql.execute<{ updateOrderStatus: { status: string } }>(
          UPDATE_ORDER_STATUS,
          {
            id: orderId,
            status: 'SHIPPED',
          },
        );
        expect(errors).toBeUndefined();
        expect(data!.updateOrderStatus.status).toBe('SHIPPED');
      });

      await test.step('UI: status updates live via the WebSocket push', async () => {
        await expect(shopPage.orderStatus(orderId)).toHaveText('SHIPPED');
        await shopPage.toast.expectMessage(`Order #${orderId} is SHIPPED`);
      });

      await test.step('DB, Kafka and WebSocket reflect SHIPPED', async () => {
        await expect
          .poll(
            async () =>
              (await db.queryOne<{ status: string }>('SELECT status FROM orders WHERE id = $1', [orderId]))?.status,
          )
          .toBe('SHIPPED');
        const event = await listener.waitForEvent(
          (e) => e.value?.order?.id === orderId && e.value.eventType === 'order.updated',
        );
        expect(event.value.order.status).toBe('SHIPPED');
        await userSocket.waitForMessage((m) => m.orderId === orderId && m.status === 'SHIPPED');
      });
    } finally {
      await listener.stop();
    }
  });

  test('an order rejected for stock leaves every layer untouched @e2e', async ({
    userGraphql,
    userSocket,
    kafka,
    db,
    makeProduct,
  }) => {
    const product = await makeProduct({ stock: 1 });
    const listener = await kafka.listen();
    try {
      const { data, errors } = await userGraphql.execute(CREATE_ORDER, {
        items: [{ productId: product.id, quantity: 3 }],
      });
      expect(data).toBeNull();
      expect(errors![0].extensions).toMatchObject({ code: '409' });

      expect(
        (await db.queryOne<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [product.id]))!.stock,
      ).toBe(1);
      const [{ count }] = await db.query<{ count: string }>('SELECT count(*) FROM order_items WHERE product_id = $1', [
        product.id,
      ]);
      expect(Number(count)).toBe(0);

      await new Promise((r) => setTimeout(r, 1_000));
      expect(
        listener.events.filter((e) =>
          e.value?.order?.items?.some((i: { productId: number }) => i.productId === product.id),
        ),
      ).toHaveLength(0);
      // No orderId exists for a rejected order, so the socket cannot be checked per order; other tests
      // running in parallel push to the same user's socket.
      expect(userSocket.messages.some((m) => m.type === 'connected')).toBe(true);
    } finally {
      await listener.stop();
    }
  });
});
