import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config para Ropas — orientado a E2E del módulo de cupones.
 *
 * Requiere que backend (:3001) y frontend (:3000) estén corriendo.
 * El comando `webServer` los levanta automáticamente, pero puedes correrlos
 * en otra terminal y comentar `webServer` si quieres ver los logs.
 *
 * Variables esperadas:
 *   E2E_BASE_URL       (default http://localhost:3000)
 *   E2E_TENANT_CODE    (default mi-tienda)
 *   E2E_ADMIN_DNI      (default 70498300)
 *   E2E_ADMIN_PASSWORD (default admin123)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // los cupones comparten estado, mejor secuencial
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Para levantar manualmente: comenta este bloque y arranca backend+frontend a mano.
  // webServer: [
  //   {
  //     command: 'pnpm --dir ../backend dev',
  //     url: 'http://localhost:3001/api/v1/health',
  //     reuseExistingServer: true,
  //     timeout: 120_000,
  //   },
  //   {
  //     command: 'pnpm dev',
  //     url: 'http://localhost:3000',
  //     reuseExistingServer: true,
  //     timeout: 120_000,
  //   },
  // ],
});
