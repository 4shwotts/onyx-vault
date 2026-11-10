import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Where the dev and preview servers forward /api. Mirrors the Vercel
// rewrite in vercel.json, so the browser only ever talks to its own origin.
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:4000'

const apiProxy = {
  '/api': {
    target: API_TARGET,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    environment: 'node',
    // Component tests opt into a browser-like DOM with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/main.jsx', 'src/test/**'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
})
