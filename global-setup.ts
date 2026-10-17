import { env } from '@config/env';
import { waitFor } from '@utils/wait';
import { logger } from '@utils/logger';

/** Fails fast with a useful message when the AUT is not running. */
export default async function globalSetup() {
  logger.info(`Test env: ${env.TEST_ENV}, waiting for ${env.API_URL}/health`);
  await waitFor(
    async () => (await fetch(`${env.API_URL}/health`)).ok,
    { timeout: 30_000, interval: 1_000, message: `AUT not reachable at ${env.API_URL}. Run "npm run aut:up" first` },
  );
}
