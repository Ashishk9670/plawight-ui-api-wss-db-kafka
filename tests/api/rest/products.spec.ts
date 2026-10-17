import { ProductSchema } from '@schemas';
import { expect, test } from '@fixtures/base.fixture';
import { buildProduct } from '@utils/data-factory';
import { validate } from '@utils/schema-validator';

test.describe('REST /api/products', () => {
  test('lists seeded products matching the schema @smoke @api', async ({ rest }) => {
    const res = await rest.get('/api/products');
    expect(res.status()).toBe(200);
    const products = await res.json();
    expect(products.length).toBeGreaterThanOrEqual(6);
    for (const p of products) validate(ProductSchema, p, `product ${p.id}`);
  });

  test('search filters by name, case-insensitively', async ({ rest }) => {
    const res = await rest.get('/api/products', { params: { search: 'KEYBOARD' } });
    const products = await res.json();
    expect(products.map((p: { name: string }) => p.name)).toContain('Mechanical Keyboard');
    expect(products.every((p: { name: string }) => /keyboard/i.test(p.name))).toBe(true);
  });

  test('category filter returns only that category', async ({ rest }) => {
    const products = await (await rest.get('/api/products', { params: { category: 'audio' } })).json();
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p: { category: string }) => p.category === 'audio')).toBe(true);
  });

  test('gets a product by id', async ({ rest, makeProduct }) => {
    const created = await makeProduct();
    const res = await rest.get(`/api/products/${created.id}`);
    expect(res.status()).toBe(200);
    expect(validate(ProductSchema, await res.json())).toMatchObject({ id: created.id, name: created.name });
  });

  test('unknown product id is 404', async ({ rest }) => {
    expect((await rest.get('/api/products/99999999')).status()).toBe(404);
  });

  test('non-numeric product id is 400', async ({ rest }) => {
    expect((await rest.get('/api/products/abc')).status()).toBe(400);
  });

  test('admin can create a product (POST) @api', async ({ makeProduct }) => {
    const input = buildProduct({ name: `Created ${Date.now()}`, price: 12.34, stock: 5 });
    const created = await makeProduct(input);
    expect(validate(ProductSchema, created)).toMatchObject({ name: input.name, price: 12.34, stock: 5 });
    expect(created.id).toBeGreaterThan(0);
  });

  test('admin can fully replace a product (PUT)', async ({ rest, adminServices, makeProduct }) => {
    const p = await makeProduct();
    const res = await rest.put(`/api/products/${p.id}`, {
      token: adminServices.session.token,
      data: { name: 'Renamed', description: 'd', category: 'c', price: 9.99, stock: 3 },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({
      id: p.id,
      name: 'Renamed',
      description: 'd',
      category: 'c',
      price: 9.99,
      stock: 3,
    });
  });

  test('admin can partially update a product (PATCH)', async ({ rest, adminServices, makeProduct }) => {
    const p = await makeProduct({ price: 10 });
    const res = await rest.patch(`/api/products/${p.id}`, { token: adminServices.session.token, data: { price: 15 } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ id: p.id, name: p.name, price: 15 });
  });

  test('admin can delete a product, after which it is gone', async ({ rest, adminServices, makeProduct }) => {
    const p = await makeProduct();
    expect((await adminServices.products.remove(p.id)).status()).toBe(204);
    expect((await rest.get(`/api/products/${p.id}`)).status()).toBe(404);
  });

  test('create rejects an invalid payload with 400', async ({ rest, adminServices }) => {
    const res = await rest.post('/api/products', { token: adminServices.session.token, data: { price: 5 } });
    expect(res.status()).toBe(400);
  });

  test('update of a missing product is 404', async ({ rest, adminServices }) => {
    const res = await rest.patch('/api/products/99999999', { token: adminServices.session.token, data: { price: 1 } });
    expect(res.status()).toBe(404);
  });

  test('create without a token is 401', async ({ rest }) => {
    expect((await rest.post('/api/products', { data: buildProduct() })).status()).toBe(401);
  });

  test('regular user cannot create a product (403) @api', async ({ userServices }) => {
    await expect(userServices.products.create(buildProduct())).rejects.toThrow(/403/);
  });

  test('regular user cannot delete a product (403)', async ({ userServices }) => {
    expect((await userServices.products.remove(1)).status()).toBe(403);
  });
});
