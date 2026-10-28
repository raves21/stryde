import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against a real API + Postgres (`bun run e2e`). Needs the dev Postgres
// (docker compose -f docker/compose.dev.yml up -d); uses its own `<db>_e2e` database and
// ports so it can run next to `bun run dev`.
const API_PORT = process.env.E2E_API_PORT ?? '3100'
const WEB_PORT = process.env.E2E_WEB_PORT ?? '5180'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // Tests share one database and log in as fresh users; run them one at a time.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'bun e2e/start-api.ts',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { E2E_API_PORT: API_PORT, E2E_WEB_PORT: WEB_PORT },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `bunx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { STRYDE_API_PORT: API_PORT },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
