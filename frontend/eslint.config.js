import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Tests and config run in Node (e.g. process.env.TZ for time-zone cases).
    files: ['**/*.test.{js,jsx}', 'vite.config.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Playwright browser tests: Node code, not React. Playwright fixtures
    // take a destructured first argument even when it's empty ({}), and
    // call use() to hand over a value — neither is a React hook.
    files: ['e2e/**/*.js', 'playwright.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-empty-pattern': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
])
