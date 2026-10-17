import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { env } from './config/env';

export const USER_STORAGE_STATE = path.resolve(__dirname, '.auth/user.json');

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  // Text snapshots (GraphQL schema) are platform independent; the visual project overrides this per platform.
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  reporter: process.env.CI
    ? [
        ['github'],
        ['blob'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['allure-playwright', { resultsDir: 'allure-results' }],
      ]
    : [['list'], ['html', { open: 'never' }], ['allure-playwright', { resultsDir: 'allure-results' }]],
  use: {
    baseURL: env.BASE_URL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Logs in once through the UI and saves the session for all UI projects.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'ui-chromium',
      testDir: './tests/ui',
      use: { ...devices['Desktop Chrome'], storageState: USER_STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'ui-firefox',
      testDir: './tests/ui',
      grep: /@smoke/,
      use: { ...devices['Desktop Firefox'], storageState: USER_STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'ui-webkit',
      testDir: './tests/ui',
      grep: /@smoke/,
      use: { ...devices['Desktop Safari'], storageState: USER_STORAGE_STATE },
      dependencies: ['setup'],
    },
    // Mobile viewports (smoke only)
    {
      name: 'mobile-chrome',
      testDir: './tests/ui',
      grep: /@smoke/,
      use: { ...devices['Pixel 7'], storageState: USER_STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      testDir: './tests/ui',
      grep: /@smoke/,
      use: { ...devices['iPhone 14'], storageState: USER_STORAGE_STATE },
      dependencies: ['setup'],
    },
    // REST, GraphQL, contract and security
    { name: 'api', testDir: './tests/api' },
    { name: 'websocket', testDir: './tests/websocket' },
    { name: 'messaging', testDir: './tests/messaging' },
    { name: 'db', testDir: './tests/db' },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'], storageState: USER_STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
});
