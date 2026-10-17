import { defineConfig, devices } from "@playwright/test";

// Smoke tests against the built static site (run `npm run build` first).
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4173" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "node scripts/serve-out.ts",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
