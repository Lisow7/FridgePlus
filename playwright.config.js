import { defineConfig, devices } from '@playwright/test'

// Config E2E minimale : Chromium desktop uniquement, mode CI-friendly.
// Lance le serveur Vite dev en parallèle (port 5173 par défaut).
export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false, // un seul navigateur à la fois pour la stabilité
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Un test qui ne passe qu'à la relance est instable : en CI, il fait échouer la
  // suite au lieu de se fondre dans le vert (audit du 2026-10-04, ARCH-17). Les
  // relances restent : leur trace dit lequel.
  failOnFlakyTests: !!process.env.CI,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
})
