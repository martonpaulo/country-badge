import { defineConfig, devices } from "@playwright/test";

import { resolveServeTarget } from "./tests/support/static-server.js";

const { command, baseURL } = await resolveServeTarget();

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  webServer: {
    command,
    url: baseURL,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chromium",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-1440",
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "desktop-1536",
      use: {
        viewport: { width: 1536, height: 864 },
      },
    },
    {
      name: "mobile-390",
      use: {
        ...devices["iPhone 12"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "mobile-430",
      use: {
        ...devices["iPhone 14 Plus"],
        viewport: { width: 430, height: 932 },
      },
    },
  ],
});
