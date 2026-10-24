import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@fixtures/base.fixture';
import { waitFor } from '@utils/wait';

/**
 * Resilience: what happens to an order when Kafka is unavailable.
 * Opt-in (stops the Kafka container, so it must not run beside other suites): npm run test:chaos
 */
const compose = (...args: string[]) =>
  execFileSync('docker', ['compose', '-f', path.resolve(__dirname, '../../docker/docker-compose.yml'), ...args], {
    stdio: 'pipe',
  });

/** Starts the broker and waits until Docker reports it healthy (KRaft needs ~15s). */
const startKafka = () => {
  compose('start', 'kafka');
  compose('up', '-d', '--wait', 'kafka');
};

test.describe.configure({ mode: 'serial' });

test.describe('Kafka outage @chaos @slow', () => {
  test.afterEach(() => {
    startKafka(); // never leave the broker down, even when a test fails (no-op if it is running)
  });

  // Regression test for a bug this suite found: the order used to be committed before its event was published,
  // so a broker outage returned an error for an order that existed and a client retry created a duplicate.
  test('an order is not persisted when its event cannot be published', async ({
    rest,
    userServices,
    db,
    makeProduct,
  }) => {
    test.setTimeout(240_000);
    const product = await makeProduct({ stock: 5 });

    compose('stop', 'kafka');
    // 0 means no response arrived (the client gave up waiting)
    const status = await rest
      .post('/api/orders', {
        token: userServices.session.token,
        data: { items: [{ productId: product.id, quantity: 1 }] },
        timeout: 200_000,
      })
      .then(
        (r) => r.status(),
        () => 0,
      )
      .finally(() => startKafka());

    const rows = await db.query('SELECT 1 FROM order_items WHERE product_id = $1', [product.id]);
    // The AUT must reject the order (503) and leave nothing behind, so a retry is safe.
    expect(status).toBe(503);
    expect(rows).toHaveLength(0);
    const stock = await db.queryOne<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [product.id]);
    expect(stock!.stock).toBe(5);
  });

  test('a status change is reverted when its event cannot be published', async ({
    userServices,
    adminServices,
    rest,
    db,
    makeProduct,
  }) => {
    test.setTimeout(240_000);
    const product = await makeProduct({ stock: 5 });
    const order = await userServices.orders.create([{ productId: product.id, quantity: 1 }]);

    compose('stop', 'kafka');
    const status = await rest
      .patch(`/api/orders/${order.id}/status`, {
        token: adminServices.session.token,
        data: { status: 'SHIPPED' },
        timeout: 200_000,
      })
      .then(
        (r) => r.status(),
        () => 0,
      )
      .finally(() => startKafka());

    expect(status).toBe(503);
    const row = await db.queryOne<{ status: string }>('SELECT status FROM orders WHERE id = $1', [order.id]);
    expect(row!.status).toBe('CREATED');
  });

  test('the AUT recovers and publishes events again after the broker returns', async ({
    kafka,
    userServices,
    makeProduct,
  }) => {
    const product = await makeProduct({ stock: 5 });
    const listener = await kafka.listen();
    try {
      // Right after an outage the AUT's producer needs a moment to reconnect, so allow up to a minute.
      const order = await waitFor(
        async () => userServices.orders.create([{ productId: product.id, quantity: 1 }]).catch(() => null),
        { timeout: 60_000, interval: 2_000, message: 'AUT did not accept orders again after the broker returned' },
      );
      await listener.waitForEvent((e) => e.value?.order?.id === order.id);
    } finally {
      await listener.stop();
    }
  });
});
