import { defineConfig, devices } from '@playwright/test'

// E2E offline contra el build de producción (con service worker), servido como en GitHub Pages.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4174/gym/',
    trace: 'off',
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'npx vite preview --base /gym/ --port 4174 --strictPort',
    url: 'http://localhost:4174/gym/',
    reuseExistingServer: !process.env.CI,
  },
})
