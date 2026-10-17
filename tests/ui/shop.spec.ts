import { expect, test } from '@fixtures/base.fixture';

test.describe('Shop: product list and search (authenticated session)', () => {
  test.beforeEach(async ({ shopPage }) => {
    await shopPage.open();
  });

  test('search filters the product list @smoke', async ({ shopPage }) => {
    await shopPage.searchFor('Keyboard');
    await shopPage.expectProductNames(['Mechanical Keyboard']);
  });

  test('search is case-insensitive and matches partial names', async ({ shopPage }) => {
    await shopPage.searchFor('mOuS');
    await shopPage.expectProductNames(['Wireless Mouse']);
  });

  test('search with no match shows an empty list', async ({ shopPage }) => {
    await shopPage.searchFor('zzz-no-such-product');
    await shopPage.expectNoProducts();
  });

  test('clearing the search restores all products', async ({ shopPage }) => {
    await shopPage.searchFor('Monitor');
    await shopPage.expectProductNames(['27" Monitor']);
    await shopPage.searchFor('');
    await shopPage.expectProductVisible('Laptop Pro 14');
    await shopPage.expectProductVisible('USB-C Hub');
  });

  test('shows the price of a product', async ({ shopPage }) => {
    expect(await shopPage.getProductPrice('Wireless Mouse')).toBe('25.50');
  });
});
