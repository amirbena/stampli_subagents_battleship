import { defineConfig, devices } from '@playwright/test';

// E2E uses a dedicated port (3010) to avoid conflicts with the normal dev frontend (3001).
// Override with E2E_FRONTEND_PORT or E2E_BASE_URL env vars if 3010 is unavailable.
const e2eFrontendPort = process.env.E2E_FRONTEND_PORT ?? '3010';
const e2eBaseUrl = process.env.E2E_BASE_URL ?? `http://localhost:${e2eFrontendPort}`;

// Select the correct Maven wrapper for the runtime OS.
const isWindows = process.platform === 'win32';
const mvnwCommand = isWindows ? 'mvnw.cmd' : './mvnw';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: e2eBaseUrl,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],

  // Automatically start frontend and backend when E2E_BASE_URL is not set.
  // Set E2E_BASE_URL=http://localhost:3000 to run against docker-compose instead.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `npm run dev -- --host 127.0.0.1 --port ${e2eFrontendPort}`,
          url: e2eBaseUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 30000,
          env: { VITE_API_BASE_URL: 'http://localhost:8081' },
        },
        {
          command: `${mvnwCommand} spring-boot:run -Pe2e -Dspring-boot.run.profiles=e2e`,
          port: 8081,
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
          cwd: '../backend',
        },
      ],
});
