import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Dexie captures indexedDB on import, so the fake must load first.
      setupFiles: ['fake-indexeddb/auto'],
      globalSetup: ['./src/test/api-server.ts'],
      // Playwright specs run with `bun run e2e`.
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }),
)
