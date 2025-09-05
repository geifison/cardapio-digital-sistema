import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 5 * 60 * 1000,
  expect: { timeout: 30_000 },
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    baseURL: process.env.BASE_URL || 'http://localhost/cardapio-digital-sistema/admin/',
    trace: 'off',
    acceptDownloads: true,
  },
  reporter: [['list']],
});