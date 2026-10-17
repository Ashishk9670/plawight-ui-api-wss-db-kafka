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

  // KNOWN BUG: the order is committed to the database before the event is published, so a broker outage
  // yields an error response for an order that exists. A client retry would create a duplicate order.
  // test.fail() keeps the suite green while documenting it, and starts failing (prompting removal) once fixed.
  test.fail(
    'an order is not persisted when its event cannot be published (or is reported as accepted)',
    async ({ rest, userServices, db, makeProduct }) => {
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
      // Consistent outcomes: accepted AND persisted, or rejected AND not persisted.
      expect(rows).toHaveLength(status === 201 ? 1 : 0);
    },
  );

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
