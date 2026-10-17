import { expect, test } from '@fixtures/base.fixture';

/**
 * Visual regression. Baselines are platform specific (fonts and anti-aliasing differ between macOS and Linux),
 * so this suite is opt-in and not part of the CI matrix:
 *   npm run test:visual            compare against baselines
 *   npm run test:visual:update     accept the current rendering as the new baseline
 */
test.describe('Visual regression @visual', () => {
  test.describe('logged out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('login page', async ({ loginPage, page }) => {
      await loginPage.open();
      await expect(page).toHaveScreenshot('login.png');
    });

    test('login page with an error', async ({ loginPage, page }) => {
      await loginPage.open();
      await loginPage.login('user@shop.test', 'wrong');
      await loginPage.expectError('Invalid credentials');
      await expect(page).toHaveScreenshot('login-error.png');
    });
  });

  test('shop page filtered to one product', async ({ shopPage }) => {
    await shopPage.open();
    await shopPage.searchFor('Mechanical Keyboard');
    await shopPage.expectProductNames(['Mechanical Keyboard']);
    // Only the list is captured: the surrounding column stretches to the height of the orders table, which grows with every run.
    await expect(shopPage.productList).toHaveScreenshot('shop-products.png');
  });

  test('cart with two items', async ({ shopPage }) => {
    await shopPage.open();
    await shopPage.addToCart('Wireless Mouse');
    await shopPage.addToCart('USB-C Hub', 2);
    await shopPage.expectCartTotal('115.50');
    await expect(shopPage.cartList).toHaveScreenshot('cart.png');
  });
});
