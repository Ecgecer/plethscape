// Temporary diagnostic: measure time-to-data-body-loaded against a running server.
// Usage: node scripts/measure-load.mjs <baseURL> [--throttle=RATE] [--cpu=SLOWDOWN]
import { chromium } from "@playwright/test";

const baseURL = process.argv[2] ?? "http://127.0.0.1:5173";
const throttleArg = process.argv.find((a) => a.startsWith("--throttle="));
const cpuArg = process.argv.find((a) => a.startsWith("--cpu="));

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const client = await page.context().newCDPSession(page);

if (cpuArg) {
  const rate = Number(cpuArg.split("=")[1]);
  await client.send("Emulation.setCPUThrottlingRate", { rate });
  console.log(`CPU throttling rate: ${rate}x`);
}
if (throttleArg) {
  const kbps = Number(throttleArg.split("=")[1]);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (kbps * 1024) / 8,
    uploadThroughput: (kbps * 1024) / 8,
    latency: 20,
  });
  console.log(`Network throttling: ${kbps} kbps`);
}

const start = Date.now();
await page.goto(baseURL);
try {
  await page.waitForSelector('[data-testid="anatomy-canvas"][data-body-loaded="true"]', {
    timeout: 90_000,
  });
  console.log(`data-body-loaded=true after ${Date.now() - start} ms`);
} catch (e) {
  const el = await page.$('[data-testid="anatomy-canvas"]');
  const attrs = el
    ? await el.evaluate((n) => ({
        anatomySource: n.getAttribute("data-anatomy-source"),
        headSource: n.getAttribute("data-head-source"),
        triangles: n.getAttribute("data-triangles"),
        bodyLoaded: n.getAttribute("data-body-loaded"),
      }))
    : null;
  console.log(`TIMEOUT after ${Date.now() - start} ms, last attrs:`, attrs);
}
await browser.close();
