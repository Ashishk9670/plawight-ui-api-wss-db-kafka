import { expect, test } from '@fixtures/base.fixture';

test.describe('UI security', () => {
  test('a product name containing HTML is rendered as text, not executed @security', async ({
    page,
    shopPage,
    makeProduct,
  }) => {
    const payload = `<img src=x onerror="window.__xss = true"><b>bold</b>`;
    await makeProduct({ name: `XSS ${payload}` });

    await shopPage.open();
    await shopPage.searchFor('XSS <img');
    await expect(shopPage.productRows).toHaveCount(1);

    // The markup must appear literally, and no element may have been created from it.
    await expect(shopPage.productRows.first()).toContainText('<img src=x onerror=');
    await expect(shopPage.productList.locator('img, b')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBeUndefined();
  });

  test('the token is not exposed in the page URL or cookies @security', async ({ page, shopPage }) => {
    await shopPage.open();
    expect(page.url()).not.toMatch(/token/i);
    expect(await page.context().cookies()).toEqual([]);
  });
});
