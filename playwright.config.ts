import { existsSync } from "node:fs";
import { chromium, defineConfig } from "@playwright/test";

const bundledChromium = chromium.executablePath();
const localChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/e2e.spec.ts", "**/*.e2e.spec.ts"],
  outputDir: "./artifacts/e2e-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Model loading on a 2-vCPU CI runner measured ~45-58s p95 (see
  // scripts/measure-load.mjs, --cpu=2/4 throttling matches CI). Test timeout
  // must exceed expect timeout by enough margin for assertions/teardown.
  timeout: process.env.CI ? 90_000 : 60_000,
  expect: { timeout: process.env.CI ? 70_000 : 30_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
    launchOptions: {
      executablePath: existsSync(bundledChromium)
        ? bundledChromium
        : existsSync(localChrome)
          ? localChrome
          : undefined,
      args: process.env.CI
        ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    // CI already runs `npm run build` before e2e; serve the built dist/
    // (vite preview) instead of `vite dev`, which re-transforms every
    // module on the fly and is measurably slower on CI runners.
    command: process.env.CI
      ? "npm run preview -- --host 127.0.0.1 --port 5173 --strictPort"
      : "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
