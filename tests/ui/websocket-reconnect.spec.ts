import { env } from '@config/env';
import { expect, test } from '@fixtures/base.fixture';
import { buildProduct } from '@utils/data-factory';

type ShopWindow = { shopSocket?: WebSocket };

// WebSocket.readyState values (the constants exist in the browser, not in the Node test process).
const OPEN = 1;
const CLOSED = 3;

test.describe('UI WebSocket resilience', () => {
  const socketState = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as unknown as ShopWindow).shopSocket?.readyState);

  test('the page reconnects after the connection drops and keeps receiving live updates', async ({
    page,
    shopPage,
    seed,
    adminServices,
  }) => {
    const [product] = await seed.products([buildProduct({ stock: 10 })]);
    const [order] = await seed.orders([
      { userEmail: env.USER_EMAIL, status: 'PAID', items: [{ productId: product.id, quantity: 1 }] },
    ]);

    await shopPage.open();
    await expect.poll(() => socketState(page)).toBe(OPEN);
    await expect(shopPage.orderStatus(order.id)).toHaveText('PAID');

    // Drop the connection from the client side, as a network blip would.
    await page.evaluate(() => (window as unknown as { shopSocket: WebSocket }).shopSocket.close());
    await expect.poll(() => socketState(page), { message: 'a new socket should be opened' }).toBe(OPEN);

    // The new connection must deliver live pushes again.
    await adminServices.orders.updateStatus(order.id, 'SHIPPED');
    await expect(shopPage.orderStatus(order.id)).toHaveText('SHIPPED');
  });

  test('changes made while disconnected show up after the reconnect (list is resynced)', async ({
    page,
    shopPage,
    seed,
    adminServices,
  }) => {
    const [product] = await seed.products([buildProduct({ stock: 10 })]);
    const [order] = await seed.orders([
      { userEmail: env.USER_EMAIL, status: 'PAID', items: [{ productId: product.id, quantity: 1 }] },
    ]);
    await shopPage.open();
    await expect(shopPage.orderStatus(order.id)).toHaveText('PAID');

    // Block the reconnect by making new sockets fail while the status changes, then allow it again.
    await page.evaluate(() => {
      const w = window as unknown as { shopSocket: WebSocket; __RealWebSocket?: typeof WebSocket };
      w.__RealWebSocket = window.WebSocket;
      window.WebSocket = class extends w.__RealWebSocket! {
        constructor(url: string | URL, protocols?: string | string[]) {
          super('ws://127.0.0.1:1/unreachable', protocols);
          void url;
        }
      } as typeof WebSocket;
      w.shopSocket.close();
    });
    await adminServices.orders.updateStatus(order.id, 'DELIVERED');
    await expect(shopPage.orderStatus(order.id)).toHaveText('PAID'); // no push reached the page

    await page.evaluate(() => {
      const w = window as unknown as { __RealWebSocket: typeof WebSocket };
      window.WebSocket = w.__RealWebSocket;
    });
    await expect(shopPage.orderStatus(order.id)).toHaveText('DELIVERED', { timeout: 15_000 });
  });

  test('logging out does not leave a reconnecting socket behind', async ({ page, shopPage }) => {
    await shopPage.open();
    await expect.poll(() => socketState(page)).toBe(OPEN);
    await shopPage.header.logout();
    await expect.poll(() => socketState(page)).toBe(CLOSED);
    // A negative check needs real time to pass: wait longer than the 1s reconnect delay.
    await new Promise((r) => setTimeout(r, 2_500));
    expect(await socketState(page)).toBe(CLOSED);
  });
});
