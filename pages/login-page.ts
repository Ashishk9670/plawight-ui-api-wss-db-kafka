import { expect } from '@playwright/test';
import { BasePage } from '@pages/base-page';

export class LoginPage extends BasePage {
  readonly email = this.testId('login-email');
  readonly password = this.testId('login-password');
  readonly submit = this.testId('login-submit');
  readonly error = this.testId('login-error');

  async open() {
    await this.goto('/');
    await expect(this.testId('login-view')).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.fill(this.email, email, 'email');
    await this.fill(this.password, password, 'password');
    await this.click(this.submit, 'Sign in');
  }

  async expectError(message: string | RegExp) {
    await expect(this.error).toContainText(message);
  }
}
