import { expect, test } from '@fixtures/base.fixture';
import { buildProduct } from '@utils/data-factory';

test.describe('REST /api/products', () => {
  test('lists seeded products @smoke @api', async ({ rest }) => {
    const res = await rest.get('/api/products');
    expect(res.status()).toBe(200);
    const products = await res.json();
    expect(products.length).toBeGreaterThanOrEqual(6);
    expect(products[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String), price: expect.any(Number) });
  });

  test('admin can create and delete a product @api', async ({ adminServices }) => {
    const created = await adminServices.products.create(buildProduct());
    try {
      expect(created.id).toBeGreaterThan(0);
    } finally {
      const res = await adminServices.products.remove(created.id);
      expect(res.status()).toBe(204);
    }
  });

  test('regular user cannot create a product @api', async ({ userServices }) => {
    await expect(userServices.products.create(buildProduct())).rejects.toThrow(/403/);
  });
});
