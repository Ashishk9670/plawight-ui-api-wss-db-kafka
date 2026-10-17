import { expect, type Locator, type Page } from '@playwright/test';

export class ToastComponent {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('toast');
  }

  async expectMessage(text: string | RegExp) {
    await expect(this.root).toContainText(text);
  }
}
