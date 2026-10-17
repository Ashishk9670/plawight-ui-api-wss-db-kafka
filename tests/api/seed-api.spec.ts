import { env } from '@config/env';
import { expect, test } from '@fixtures/base.fixture';
import { buildProduct } from '@utils/data-factory';

test.describe('Seeding API (test support)', () => {
  test('seeds products in bulk without raw SQL @smoke', async ({ seed, rest }) => {
    const [a, b] = await seed.products([buildProduct({ price: 5 }), buildProduct({ price: 6 })]);
    expect((await rest.get(`/api/products/${a.id}`)).status()).toBe(200);
    expect((await rest.get(`/api/products/${b.id}`)).status()).toBe(200);
  });

  test('seeds orders directly in any status', async ({ seed, userServices }) => {
    const [product] = await seed.products([buildProduct({ price: 10, stock: 10 })]);
    const orders = await seed.orders([
      { userEmail: env.USER_EMAIL, status: 'PAID', items: [{ productId: product.id, quantity: 2 }] },
      { userEmail: env.USER_EMAIL, status: 'DELIVERED', items: [{ productId: product.id, quantity: 1 }] },
    ]);
    expect(orders.map((o) => o.status)).toEqual(['PAID', 'DELIVERED']);
    expect(orders.map((o) => o.total)).toEqual([20, 10]);
    // Seeded orders belong to the real user and are readable through the normal API.
    expect((await userServices.orders.get(orders[0].id)).status).toBe('PAID');
  });

  test('the seeding API is admin-only', async ({ rest, userServices }) => {
    const res = await rest.post('/api/test/seed/products', {
      token: userServices.session.token,
      data: { products: [] },
    });
    expect(res.status()).toBe(403);
    expect((await rest.post('/api/test/seed/products', { data: { products: [] } })).status()).toBe(401);
  });

  test('force delete removes a product that has orders', async ({ seed, rest }) => {
    const [product] = await seed.products([buildProduct({ stock: 5 })]);
    await seed.orders([{ userEmail: env.USER_EMAIL, items: [{ productId: product.id, quantity: 1 }] }]);
    expect((await seed.removeProduct(product.id)).status()).toBe(204);
    expect((await rest.get(`/api/products/${product.id}`)).status()).toBe(404);
  });
});
