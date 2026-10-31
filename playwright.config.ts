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
    // The same pages for a German-language browser in Berlin and an
    // English one in Los Angeles (16 hours behind Singapore): number input,
    // dates and "today" must not depend on either.
    {
      name: "de-DE",
      use: {
        ...devices["Desktop Chrome"],
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
      },
    },
    {
      name: "los-angeles",
      use: {
        ...devices["Desktop Chrome"],
        locale: "en-US",
        timezoneId: "America/Los_Angeles",
      },
    },
  ],
  webServer: {
    command: "node scripts/serve-out.ts",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
