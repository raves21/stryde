import { defineConfig } from 'vitest/config'

// Keep in sync with src/test/database-url.ts (config can't import extensionless TS).
function toTestDatabaseUrl(url: string): string {
  const parsed = new URL(url)
  const name = parsed.pathname.replace(/^\//, '')
  if (!name.endsWith('_test')) parsed.pathname = `/${name}_test`
  return parsed.toString()
}

// API integration tests need a real Postgres: set DATABASE_URL and they run against a
// fresh `<db>_test` database (recreated by global-setup). Without it they're skipped.
const testUrl = process.env.DATABASE_URL ? toTestDatabaseUrl(process.env.DATABASE_URL) : undefined

export default defineConfig({
  test: {
    globalSetup: './src/test/global-setup.ts',
    env: testUrl ? { DATABASE_URL: testUrl, STRYDE_INTEGRATION: '1' } : {},
    // Integration tests share one database.
    fileParallelism: false,
  },
})
