import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync(macChrome) ? macChrome : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    headless: true,
    launchOptions: executablePath ? { executablePath } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4174/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  }
});
