import { defineConfig, devices } from '@playwright/test';
import base, { USER_STORAGE_STATE } from './playwright.config';

/**
 * Opt-in suites that must not run beside the normal projects:
 *  - perf:   latency budgets (needs a quiet machine, so a single worker)
 *  - visual: screenshot baselines (platform specific)
 *  - chaos:  pauses the Kafka container
 * Run with: npm run test:perf | test:visual | test:chaos
 */
export default defineConfig({
  ...base,
  workers: 1,
  fullyParallel: false,
  projects: [
    { name: 'setup', testDir: './tests', testMatch: /auth\.setup\.ts/ },
    { name: 'perf', testDir: './tests/perf' },
    {
      name: 'visual',
      testDir: './tests/visual',
      snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
      expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
      use: { ...devices['Desktop Chrome'], storageState: USER_STORAGE_STATE, viewport: { width: 1280, height: 800 } },
      dependencies: ['setup'],
    },
    { name: 'chaos', testDir: './tests/chaos', timeout: 300_000 },
  ],
});
