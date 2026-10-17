import { test } from '@fixtures/base.fixture';

test.describe('Cart', () => {
  test.beforeEach(async ({ shopPage }) => {
    await shopPage.open();
    await shopPage.expectCartEmpty();
  });

  test('adding a product updates cart and total @smoke', async ({ shopPage }) => {
    await shopPage.addToCart('Wireless Mouse');
    await shopPage.expectCartItem('Wireless Mouse', 1);
    await shopPage.expectCartTotal('25.50');
  });

  test('adding the same product twice increases quantity', async ({ shopPage }) => {
    await shopPage.addToCart('Wireless Mouse', 2);
    await shopPage.expectCartItem('Wireless Mouse', 2);
    await shopPage.expectCartTotal('51.00');
  });

  test('total sums multiple different products', async ({ shopPage }) => {
    await shopPage.addToCart('Wireless Mouse');
    await shopPage.addToCart('Mechanical Keyboard');
    await shopPage.expectCartItem('Wireless Mouse', 1);
    await shopPage.expectCartItem('Mechanical Keyboard', 1);
    await shopPage.expectCartTotal('115.49');
  });

  test('placing an order with an empty cart shows a message', async ({ shopPage }) => {
    await shopPage.submitOrder();
    await shopPage.toast.expectMessage('Cart is empty');
  });
});
