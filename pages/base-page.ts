import { test, type Locator, type Page } from '@playwright/test';
import { HeaderComponent } from '@components/header.component';
import { ToastComponent } from '@components/toast.component';
import { logger } from '@utils/logger';

export abstract class BasePage {
  readonly header: HeaderComponent;
  readonly toast: ToastComponent;

  constructor(protected page: Page) {
    this.header = new HeaderComponent(page);
    this.toast = new ToastComponent(page);
  }

  protected testId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  async goto(path = '/') {
    await test.step(`Open ${path}`, async () => {
      logger.info(`UI goto ${path}`);
      await this.page.goto(path);
    });
  }

  protected async click(locator: Locator, description: string) {
    await test.step(`Click ${description}`, () => locator.click());
  }

  protected async fill(locator: Locator, value: string, description: string) {
    await test.step(`Fill ${description}`, () => locator.fill(value));
  }
}
