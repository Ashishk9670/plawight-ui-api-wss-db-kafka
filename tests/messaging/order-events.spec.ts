import { OrderEventSchema } from '@schemas';
import { expect, test } from '@fixtures/base.fixture';
import { validate } from '@utils/schema-validator';

test.describe('Kafka "orders" topic', () => {
  test('order.created is published with a valid payload @smoke @kafka', async ({ kafka, userServices, makeProduct }) => {
    const listener = await kafka.listen();
    try {
      const product = await makeProduct({ price: 10 });
      const order = await userServices.orders.create([{ productId: product.id, quantity: 2 }]);

      const event = await listener.waitForEvent((e) => e.value?.order?.id === order.id && e.value.eventType === 'order.created');
      const payload = validate(OrderEventSchema, event.value, 'order.created event');

      expect(event.key).toBe(String(order.id));
      expect(payload.order).toEqual(order);
      expect(payload.order.total).toBe(20);
    } finally {
      await listener.stop();
    }
  });

  test('order.updated is published when an admin changes the status', async ({ kafka, userServices, adminServices, makeProduct }) => {
    const listener = await kafka.listen();
    try {
      const product = await makeProduct();
      const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
      await adminServices.orders.updateStatus(order.id, 'SHIPPED');

      const event = await listener.waitForEvent((e) => e.value?.eventType === 'order.updated' && e.value.order.id === order.id);
      expect(validate(OrderEventSchema, event.value).order.status).toBe('SHIPPED');
    } finally {
      await listener.stop();
    }
  });

  test('events for one order arrive in lifecycle order', async ({ kafka, userServices, adminServices, makeProduct }) => {
    const listener = await kafka.listen();
    try {
      const product = await makeProduct();
      const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);
      await adminServices.orders.updateStatus(order.id, 'PAID');
      await adminServices.orders.updateStatus(order.id, 'SHIPPED');
      await listener.waitForEvent((e) => e.value?.order?.id === order.id && e.value.order.status === 'SHIPPED');

      const lifecycle = listener.events
        .filter((e) => e.value?.order?.id === order.id)
        .map((e) => `${e.value.eventType}:${e.value.order.status}`);
      expect(lifecycle).toEqual(['order.created:CREATED', 'order.updated:PAID', 'order.updated:SHIPPED']);
    } finally {
      await listener.stop();
    }
  });

  test('a rejected order (insufficient stock) publishes no event', async ({ kafka, rest, userServices, makeProduct }) => {
    const listener = await kafka.listen();
    try {
      const product = await makeProduct({ stock: 1 });
      const res = await rest.post('/api/orders', {
        token: userServices.session.token,
        data: { items: [{ productId: product.id, quantity: 5 }] },
      });
      expect(res.status()).toBe(409);
      await new Promise((r) => setTimeout(r, 1_500));
      const forProduct = listener.events.filter((e) => e.value?.order?.items?.some((i: { productId: number }) => i.productId === product.id));
      expect(forProduct).toHaveLength(0);
    } finally {
      await listener.stop();
    }
  });
});
