import { env } from '@config/env';
import { expect, test } from '@fixtures/base.fixture';

test.describe('REST /api/auth', () => {
  test('login returns a token and the user profile @smoke @api', async ({ rest }) => {
    const res = await rest.post('/api/auth/login', { data: { email: env.USER_EMAIL, password: env.USER_PASSWORD } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toEqual({ id: expect.any(Number), email: env.USER_EMAIL, name: 'Test User', role: 'user' });
    expect(body.user).not.toHaveProperty('password_hash');
  });

  const negativeCases = [
    { title: 'wrong password', data: { email: env.USER_EMAIL, password: 'nope' }, status: 401 },
    { title: 'unknown email', data: { email: 'nobody@shop.test', password: 'x' }, status: 401 },
    { title: 'missing password', data: { email: env.USER_EMAIL }, status: 400 },
    { title: 'missing email', data: { password: env.USER_PASSWORD }, status: 400 },
    { title: 'empty body', data: {}, status: 400 },
  ];
  for (const { title, data, status } of negativeCases) {
    test(`login rejects ${title} with ${status}`, async ({ rest }) => {
      const res = await rest.post('/api/auth/login', { data });
      expect(res.status()).toBe(status);
      expect(await res.json()).toEqual({ error: expect.any(String) });
    });
  }

  test('/me returns the current user for a valid token', async ({ userServices, rest }) => {
    const res = await rest.get('/api/auth/me', { token: userServices.session.token });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ email: env.USER_EMAIL, role: 'user' });
  });

  test('/me without a token is 401', async ({ rest }) => {
    expect((await rest.get('/api/auth/me')).status()).toBe(401);
  });

  test('/me with a tampered token is 401', async ({ rest }) => {
    expect((await rest.get('/api/auth/me', { token: 'not.a.jwt' })).status()).toBe(401);
  });
});
