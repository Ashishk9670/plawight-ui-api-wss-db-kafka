import { USER_STORAGE_STATE } from '../playwright.config';
import { env } from '@config/env';
import { test as setup } from '@fixtures/base.fixture';

setup('authenticate standard user via UI', async ({ page, loginPage, shopPage }) => {
  await loginPage.open();
  await loginPage.login(env.USER_EMAIL, env.USER_PASSWORD);
  await shopPage.header.expectLoggedInAs('Test User');
  await page.context().storageState({ path: USER_STORAGE_STATE });
});
