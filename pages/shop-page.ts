import { expect, type Locator } from '@playwright/test';
import { BasePage } from '@pages/base-page';

export class ShopPage extends BasePage {
  readonly search = this.testId('product-search');
  readonly productList = this.testId('product-list');
  readonly cartList = this.testId('cart-list');
  readonly cartTotal = this.testId('cart-total');
  readonly placeOrder = this.testId('place-order');
  readonly ordersTable = this.testId('orders-table');

  async open() {
    await this.goto('/');
    await expect(this.testId('shop-view')).toBeVisible();
    // Products load asynchronously after the view is shown.
    await expect(this.productRows.first()).toBeVisible();
  }

  get productRows(): Locator {
    return this.productList.locator('li');
  }

  productRow(name: string): Locator {
    return this.productRows.filter({ hasText: name });
  }

  async searchFor(text: string) {
    await this.fill(this.search, text, 'product search');
  }

  async addToCart(name: string, times = 1) {
    for (let i = 0; i < times; i++) {
      await this.click(this.productRow(name).getByRole('button', { name: 'Add' }), `Add "${name}" to cart`);
    }
  }

  async submitOrder() {
    await this.click(this.placeOrder, 'Place order');
  }

  /**
   * Places the order and returns the new order id from the API response. The toast is not used because the
   * WebSocket push ("Order #N is CREATED") replaces the "placed" toast within milliseconds.
   */
  async submitOrderAndGetId(): Promise<number> {
    const response = this.page.waitForResponse(
      (r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST',
    );
    await this.submitOrder();
    const res = await response;
    if (res.status() !== 201) throw new Error(`Order was not created: ${res.status()} ${await res.text()}`);
    return (await res.json()).id;
  }

  async getProductPrice(name: string): Promise<string> {
    return this.productRow(name).getByTestId('product-price').innerText();
  }

  async expectProductVisible(name: string) {
    await expect(this.productRow(name)).toBeVisible();
  }

  async expectProductNames(names: string[]) {
    await expect(this.productRows.getByTestId('product-name')).toHaveText(names);
  }

  async expectNoProducts() {
    await expect(this.productRows).toHaveCount(0);
  }

  async expectCartItem(name: string, quantity: number) {
    await expect(this.cartList.locator('li', { hasText: name })).toHaveText(`${name} x ${quantity}`);
  }

  async expectCartEmpty() {
    await expect(this.cartList.locator('li')).toHaveCount(0);
    await this.expectCartTotal('0.00');
  }

  async expectCartTotal(total: string) {
    await expect(this.cartTotal).toHaveText(total);
  }

  orderRow(orderId: number): Locator {
    return this.testId(`order-row-${orderId}`);
  }

  orderStatus(orderId: number): Locator {
    return this.orderRow(orderId).getByTestId('order-status');
  }

  async expectOrder(orderId: number, { status, total }: { status: string; total: string }) {
    await expect(this.orderStatus(orderId)).toHaveText(status);
    await expect(this.orderRow(orderId).locator('td').nth(1)).toHaveText(total);
  }
}
