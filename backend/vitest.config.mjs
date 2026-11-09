import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    globalSetup: ['./test/globalSetup.mjs'],
    setupFiles: ['./test/setup.mjs'],
    // Every API test file shares one throwaway database, so files run one
    // at a time. Each file still gets its own process (fresh rate limiters).
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 180000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/index.js'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
