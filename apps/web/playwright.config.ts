import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../../output/playwright/artifacts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "../../output/playwright/report" }]],
  use: {
    baseURL: "http://localhost:3005",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "on"
  },
  webServer: {
    command:
      "PLAYWRIGHT_TEST=1 APP_BASE_URL=http://localhost:3005 pnpm dev --port 3005",
    url: "http://localhost:3005",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
