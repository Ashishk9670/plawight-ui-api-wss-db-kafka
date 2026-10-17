import { env } from '@config/env';
import { expect, test } from '@fixtures/base.fixture';

/**
 * Response-time budgets against the local docker AUT. Budgets are deliberately loose so they catch
 * order-of-magnitude regressions (an N+1 query, a missing index) rather than machine noise.
 */
const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil((p / 100) * values.length) - 1];

async function timeMany(n: number, call: () => Promise<unknown>) {
  await call(); // warm-up
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await call();
    samples.push(performance.now() - t);
  }
  return { p50: percentile(samples, 50), p95: percentile(samples, 95), max: Math.max(...samples) };
}

test.describe('API latency budgets', () => {
  test('GET /api/products p95 < 300ms @perf', async ({ rest }) => {
    const stats = await timeMany(30, () => rest.get('/api/products'));
    test.info().annotations.push({ type: 'latency', description: JSON.stringify(stats) });
    expect(stats.p95).toBeLessThan(300);
  });

  test('POST /api/auth/login p95 < 500ms @perf', async ({ rest }) => {
    const stats = await timeMany(20, () =>
      rest.post('/api/auth/login', { data: { email: env.USER_EMAIL, password: env.USER_PASSWORD } }),
    );
    test.info().annotations.push({ type: 'latency', description: JSON.stringify(stats) });
    expect(stats.p95).toBeLessThan(500);
  });

  test('POST /api/orders p95 < 1000ms (DB transaction + Kafka publish) @perf', async ({
    rest,
    userServices,
    makeProduct,
  }) => {
    const product = await makeProduct({ stock: 100 });
    const stats = await timeMany(15, () =>
      rest.post('/api/orders', {
        token: userServices.session.token,
        data: { items: [{ productId: product.id, quantity: 1 }] },
      }),
    );
    test.info().annotations.push({ type: 'latency', description: JSON.stringify(stats) });
    expect(stats.p95).toBeLessThan(1000);
  });

  test('GraphQL products p95 < 300ms @perf', async ({ graphql }) => {
    const stats = await timeMany(30, () => graphql.execute(`{ products { id name price stock } }`));
    expect(stats.p95).toBeLessThan(300);
  });
});
