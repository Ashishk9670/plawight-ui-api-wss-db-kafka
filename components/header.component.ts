import { expect, type Locator, type Page } from '@playwright/test';

export class HeaderComponent {
  readonly userName: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.userName = page.getByTestId('user-name');
    this.logoutButton = page.getByTestId('logout-button');
  }

  async expectLoggedInAs(name: string) {
    await expect(this.userName).toHaveText(name);
  }

  async logout() {
    await this.logoutButton.click();
  }
}
