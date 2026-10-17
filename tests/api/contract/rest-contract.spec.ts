import type { APIResponse } from '@playwright/test';
import { env } from '@config/env';
import { expect, test } from '@fixtures/base.fixture';
import { openApiViolations } from '@utils/openapi-validator';

/** Asserts that status and body of `res` are documented in aut/openapi.json for the given operation. */
async function expectContract(res: APIResponse, method: string, pathTemplate: string) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  expect(
    openApiViolations(method, pathTemplate, res.status(), body),
    `${method} ${pathTemplate} -> ${res.status()}`,
  ).toEqual([]);
}

test.describe('REST contract (OpenAPI)', () => {
  test('the spec is served by the AUT @smoke @contract', async ({ rest }) => {
    const res = await rest.get('/openapi.json');
    expect(res.status()).toBe(200);
    expect((await res.json()).info.title).toBe('Shop AUT API');
  });

  test('auth endpoints', async ({ rest, userServices }) => {
    await expectContract(
      await rest.post('/api/auth/login', { data: { email: env.USER_EMAIL, password: env.USER_PASSWORD } }),
      'post',
      '/api/auth/login',
    );
    await expectContract(
      await rest.post('/api/auth/login', { data: { email: env.USER_EMAIL, password: 'bad' } }),
      'post',
      '/api/auth/login',
    );
    await expectContract(await rest.post('/api/auth/login', { data: {} }), 'post', '/api/auth/login');
    await expectContract(await rest.get('/api/auth/me', { token: userServices.session.token }), 'get', '/api/auth/me');
    await expectContract(await rest.get('/api/auth/me'), 'get', '/api/auth/me');
  });

  test('product endpoints', async ({ rest, adminServices, userServices, makeProduct }) => {
    const p = await makeProduct();
    const admin = adminServices.session.token;

    await expectContract(await rest.get('/api/products'), 'get', '/api/products');
    await expectContract(await rest.get(`/api/products/${p.id}`), 'get', '/api/products/{id}');
    await expectContract(await rest.get('/api/products/99999999'), 'get', '/api/products/{id}');
    await expectContract(await rest.get('/api/products/abc'), 'get', '/api/products/{id}');
    await expectContract(
      await rest.post('/api/products', { token: admin, data: { name: 'Contract', price: 1 } }).then(async (r) => {
        if (r.status() === 201) await adminServices.products.remove((await r.json()).id);
        return r;
      }),
      'post',
      '/api/products',
    );
    await expectContract(await rest.post('/api/products', { token: admin, data: {} }), 'post', '/api/products');
    await expectContract(await rest.post('/api/products', { data: { name: 'x', price: 1 } }), 'post', '/api/products');
    await expectContract(
      await rest.post('/api/products', { token: userServices.session.token, data: { name: 'x', price: 1 } }),
      'post',
      '/api/products',
    );
    await expectContract(
      await rest.put(`/api/products/${p.id}`, {
        token: admin,
        data: { name: 'n', description: '', category: 'c', price: 1, stock: 1 },
      }),
      'put',
      '/api/products/{id}',
    );
    await expectContract(
      await rest.patch(`/api/products/${p.id}`, { token: admin, data: { price: 2 } }),
      'patch',
      '/api/products/{id}',
    );
    await expectContract(
      await rest.patch('/api/products/99999999', { token: admin, data: { price: 2 } }),
      'patch',
      '/api/products/{id}',
    );
  });

  test('delete product responses', async ({ rest, adminServices, userServices, makeProduct }) => {
    const free = await makeProduct();
    const used = await makeProduct();
    await userServices.orders.create([{ productId: used.id, quantity: 1 }]);
    const admin = adminServices.session.token;

    await expectContract(
      await rest.delete(`/api/products/${used.id}`, { token: admin }),
      'delete',
      '/api/products/{id}',
    ); // 409
    await expectContract(
      await rest.delete(`/api/products/${free.id}`, { token: admin }),
      'delete',
      '/api/products/{id}',
    ); // 204
    await expectContract(
      await rest.delete(`/api/products/${free.id}`, { token: admin }),
      'delete',
      '/api/products/{id}',
    ); // 404
  });

  test('order endpoints', async ({ rest, adminServices, userServices, makeProduct }) => {
    const p = await makeProduct({ stock: 5 });
    const user = userServices.session.token;
    const admin = adminServices.session.token;

    const created = await rest.post('/api/orders', {
      token: user,
      data: { items: [{ productId: p.id, quantity: 1 }] },
    });
    await expectContract(created, 'post', '/api/orders');
    const id = (await created.json()).id;

    await expectContract(await rest.post('/api/orders', { token: user, data: { items: [] } }), 'post', '/api/orders');
    await expectContract(
      await rest.post('/api/orders', { token: user, data: { items: [{ productId: 99999999, quantity: 1 }] } }),
      'post',
      '/api/orders',
    );
    await expectContract(
      await rest.post('/api/orders', { token: user, data: { items: [{ productId: p.id, quantity: 99 }] } }),
      'post',
      '/api/orders',
    );
    await expectContract(await rest.get('/api/orders', { token: user }), 'get', '/api/orders');
    await expectContract(await rest.get('/api/orders'), 'get', '/api/orders');
    await expectContract(await rest.get(`/api/orders/${id}`, { token: user }), 'get', '/api/orders/{id}');
    await expectContract(await rest.get('/api/orders/99999999', { token: user }), 'get', '/api/orders/{id}');
    await expectContract(
      await rest.patch(`/api/orders/${id}/status`, { token: admin, data: { status: 'PAID' } }),
      'patch',
      '/api/orders/{id}/status',
    );
    await expectContract(
      await rest.patch(`/api/orders/${id}/status`, { token: admin, data: { status: 'NOPE' } }),
      'patch',
      '/api/orders/{id}/status',
    );
    await expectContract(
      await rest.patch(`/api/orders/${id}/status`, { token: user, data: { status: 'PAID' } }),
      'patch',
      '/api/orders/{id}/status',
    );
    await expectContract(
      await rest.patch('/api/orders/99999999/status', { token: admin, data: { status: 'PAID' } }),
      'patch',
      '/api/orders/{id}/status',
    );
  });

  test('the validator itself catches a violation', async () => {
    const bad = openApiViolations('get', '/api/products/{id}', 200, { id: 'not-a-number', name: 'x' });
    expect(bad.length).toBeGreaterThan(0);
    expect(openApiViolations('get', '/api/products/{id}', 418, {})[0]).toContain('not documented');
  });
});
