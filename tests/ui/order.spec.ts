import { expect, test } from '@fixtures/base.fixture';

test.describe('Checkout (UI)', () => {
  test('placing an order shows it as CREATED with the correct total @smoke', async ({ shopPage }) => {
    await shopPage.open();
    await shopPage.addToCart('Wireless Mouse', 2);
    await shopPage.addToCart('USB-C Hub');
    await shopPage.expectCartTotal('96.00');

    const orderId = await shopPage.submitOrderAndGetId();

    await shopPage.expectOrder(orderId, { status: 'CREATED', total: '96.00' });
    await shopPage.expectCartEmpty();
  });

  test('order status change made by an admin appears live in the UI', async ({ shopPage, adminServices }) => {
    await shopPage.open();
    await shopPage.addToCart('Wireless Mouse');
    const orderId = await shopPage.submitOrderAndGetId();
    await shopPage.expectOrder(orderId, { status: 'CREATED', total: '25.50' });

    // Admin changes the status through the API; the UI learns about it through the WebSocket push.
    const res = await adminServices.orders.updateStatus(orderId, 'SHIPPED');
    expect(res.status()).toBe(200);

    await expect(shopPage.orderStatus(orderId)).toHaveText('SHIPPED');
    await shopPage.toast.expectMessage(`Order #${orderId} is SHIPPED`);
  });
});
