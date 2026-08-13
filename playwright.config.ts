import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "off",
    // Without these, Chromium can throttle a page's timers as if it were an
    // occluded/background tab (especially under parallel workers sharing
    // one browser process), which desyncs the app's own setTimeout-driven
    // phase timing from real wall-clock waits in the tests below.
    launchOptions: {
      args: ["--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"],
    },
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173/thoth/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  // Baselines are recorded inside the same mcr.microsoft.com/playwright Docker
  // image the CI workflow runs in (see .github/workflows/deploy.yml), so font
  // rendering matches between recording and comparison. A small ratio still
  // absorbs harmless anti-aliasing noise.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
});
