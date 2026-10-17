import { WebSocketClient } from '@clients/websocket-client';
import { WsOrderStatusSchema } from '@schemas';
import { expect, test } from '@fixtures/base.fixture';
import { validate } from '@utils/schema-validator';

test.describe('WebSocket order status pushes', () => {
  test('creating an order pushes CREATED to its owner @smoke @ws', async ({ userSocket, userServices, makeProduct }) => {
    const product = await makeProduct();
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);

    const msg = await userSocket.waitForMessage((m) => m.type === 'order.status' && m.orderId === order.id);
    expect(validate(WsOrderStatusSchema, msg)).toEqual({ type: 'order.status', orderId: order.id, status: 'CREATED' });
  });

  test('status changes are pushed in order', async ({ userSocket, userServices, adminServices, makeProduct }) => {
    const product = await makeProduct();
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);

    for (const status of ['PAID', 'SHIPPED', 'DELIVERED']) {
      expect((await adminServices.orders.updateStatus(order.id, status)).status()).toBe(200);
      await userSocket.waitForMessage((m) => m.orderId === order.id && m.status === status);
    }

    const statuses = userSocket.messages.filter((m) => m.orderId === order.id).map((m) => m.status);
    expect(statuses).toEqual(['CREATED', 'PAID', 'SHIPPED', 'DELIVERED']);
  });

  test('another user does not receive the owner\'s order events', async ({ userSocket, adminSocket, userServices, makeProduct }) => {
    const product = await makeProduct();
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);

    // The owner is the positive control: once it has the push, the admin socket would have had it too.
    await userSocket.waitForMessage((m) => m.orderId === order.id);
    await new Promise((r) => setTimeout(r, 500));
    expect(adminSocket.messages.filter((m) => m.orderId === order.id)).toHaveLength(0);
  });

  test('a push made while disconnected is not replayed', async ({ userServices, adminServices, makeProduct }) => {
    const product = await makeProduct();
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
    await adminServices.orders.updateStatus(order.id, 'PAID');

    const late = new WebSocketClient(userServices.session.token);
    await late.connect();
    try {
      await late.waitForMessage((m) => m.type === 'connected');
      await new Promise((r) => setTimeout(r, 500));
      expect(late.messages.filter((m) => m.orderId === order.id)).toHaveLength(0);
    } finally {
      await late.close();
    }
  });
});
