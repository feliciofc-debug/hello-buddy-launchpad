import { defineConfig } from "@playwright/test";

const chromePath = process.env.PLAYWRIGHT_CHROME_PATH;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: chromePath ? { executablePath: chromePath } : {},
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
