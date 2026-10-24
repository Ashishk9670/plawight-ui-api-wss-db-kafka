import { PRODUCT, PRODUCTS } from '@clients/graphql-operations';
import { ProductSchema } from '@schemas';
import type { Product } from '@schemas/graphql.generated';
import { expect, test } from '@fixtures/base.fixture';
import { validate } from '@utils/schema-validator';

test.describe('GraphQL products', () => {
  test('products query returns the seeded catalogue @smoke @graphql', async ({ graphql }) => {
    const { data, errors } = await graphql.execute<{ products: Product[] }>(PRODUCTS);
    expect(errors).toBeUndefined();
    expect(data!.products.length).toBeGreaterThanOrEqual(6);
    for (const p of data!.products) validate(ProductSchema, p, `product ${p.id}`);
  });

  test('products query uses variables for search', async ({ graphql }) => {
    const { data } = await graphql.execute<{ products: Product[] }>(PRODUCTS, { search: 'monitor' });
    expect(data!.products.map((p) => p.name)).toEqual(['27" Monitor']);
  });

  test('products query filters by category', async ({ graphql }) => {
    const { data } = await graphql.execute<{ products: Product[] }>(PRODUCTS, { category: 'audio' });
    expect(data!.products.length).toBeGreaterThan(0);
    expect(data!.products.every((p) => p.category === 'audio')).toBe(true);
  });

  test('product(id) returns one product matching REST', async ({ graphql, rest, makeProduct }) => {
    const created = await makeProduct();
    const { data } = await graphql.execute<{ product: Product }>(PRODUCT, { id: created.id });
    const restProduct = await (await rest.get(`/api/products/${created.id}`)).json();
    expect(data!.product).toEqual(restProduct);
  });

  test('product(id) for an unknown id is null, not an error', async ({ graphql }) => {
    const { data, errors } = await graphql.execute<{ product: Product | null }>(PRODUCT, { id: 99999999 });
    expect(errors).toBeUndefined();
    expect(data!.product).toBeNull();
  });

  test('requesting a subset of fields returns only those fields', async ({ graphql }) => {
    const { data } = await graphql.execute<{ products: Record<string, unknown>[] }>(`{ products { id name } }`);
    expect(Object.keys(data!.products[0]).sort()).toEqual(['id', 'name']);
  });

  // graphql-http answers 200 (not 400) unless the client sends Accept: application/graphql-response+json.
  test('querying an unknown field returns a validation error and no data', async ({ graphql }) => {
    const { body } = await graphql.executeRaw(`{ products { nonExistentField } }`);
    expect(body.data).toBeUndefined();
    expect(body.errors![0].message).toContain('nonExistentField');
  });

  test('a missing required variable returns a validation error and no data', async ({ graphql }) => {
    const { body } = await graphql.executeRaw(PRODUCT);
    expect(body.data).toBeUndefined();
    expect(body.errors![0].message).toMatch(/\$id/);
  });
});
