import { env } from '@config/env';
import { expect, test } from '@fixtures/base.fixture';

test.describe('Login', () => {
  // These tests start logged out; the rest of the UI suite reuses the saved session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('valid credentials show the shop @smoke', async ({ loginPage, shopPage }) => {
    await loginPage.open();
    await loginPage.login(env.USER_EMAIL, env.USER_PASSWORD);
    await shopPage.header.expectLoggedInAs('Test User');
    await shopPage.expectProductVisible('Wireless Mouse');
  });

  const negativeCases = [
    { title: 'wrong password', email: env.USER_EMAIL, password: 'wrong-password', error: 'Invalid credentials' },
    { title: 'unknown user', email: 'nobody@shop.test', password: 'Password123!', error: 'Invalid credentials' },
    { title: 'empty email', email: '', password: 'Password123!', error: 'email and password are required' },
    { title: 'empty password', email: env.USER_EMAIL, password: '', error: 'email and password are required' },
  ];

  for (const { title, email, password, error } of negativeCases) {
    test(`rejects login with ${title}`, async ({ loginPage }) => {
      await loginPage.open();
      await loginPage.login(email, password);
      await loginPage.expectError(error);
    });
  }

  test('logout returns to the login screen', async ({ loginPage, shopPage, page }) => {
    await loginPage.open();
    await loginPage.login(env.USER_EMAIL, env.USER_PASSWORD);
    await shopPage.header.expectLoggedInAs('Test User');
    await shopPage.header.logout();
    await expect(loginPage.submit).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });

  test('session persists across reload', async ({ loginPage, shopPage, page }) => {
    await loginPage.open();
    await loginPage.login(env.USER_EMAIL, env.USER_PASSWORD);
    await shopPage.header.expectLoggedInAs('Test User');
    await page.reload();
    await shopPage.header.expectLoggedInAs('Test User');
  });
});
