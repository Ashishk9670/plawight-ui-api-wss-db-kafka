import { test } from '@fixtures/base.fixture';

/**
 * Seed for the Playwright test agents (planner, generator, healer; see ai/README.md).
 * It leaves the browser on the shop page of the logged-in standard user, the same starting point the
 * existing UI specs use, so generated tests inherit our fixtures, page objects and session handling.
 */
test.describe('Seed', () => {
  test('authenticated shop page', async ({ shopPage }) => {
    await shopPage.open();
  });
});
