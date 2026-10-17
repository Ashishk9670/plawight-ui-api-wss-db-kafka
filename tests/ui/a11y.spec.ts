import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@fixtures/base.fixture';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}`,
  );
}

test.describe('Accessibility (axe, WCAG 2.1 AA) @a11y', () => {
  test.describe('logged out', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('login page has no violations', async ({ loginPage, page }) => {
      await loginPage.open();
      expect(await violations(page)).toEqual([]);
    });

    test('login form can be completed with the keyboard only', async ({ loginPage, page }) => {
      await loginPage.open();
      await loginPage.email.focus();
      await page.keyboard.type('user@shop.test');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Password123!');
      await page.keyboard.press('Enter');
      await expect(loginPage.header.userName).toHaveText('Test User');
    });
  });

  test('shop page has no violations', async ({ shopPage, page }) => {
    await shopPage.open();
    expect(await violations(page)).toEqual([]);
  });

  test('shop page with an item in the cart and a toast has no violations', async ({ shopPage, page }) => {
    await shopPage.open();
    await shopPage.addToCart('Wireless Mouse');
    await shopPage.submitOrder();
    await expect(shopPage.toast.root).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
