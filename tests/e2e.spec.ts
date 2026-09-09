import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  DEFAULT_PHYSIOLOGY,
  getCardiacState,
  samplePPG,
} from "../src/simulation";

const browserErrors = new WeakMap<Page, string[]>();
const ppg = (page: Page) =>
  page.getByRole("img", {
    name: /^Synthetic (streaming|single-cycle) PPG waveform/,
  });

async function canvasHash(canvas: Locator): Promise<number> {
  return canvas.evaluate((node: HTMLCanvasElement) => {
    const context = node.getContext("2d")!;
    const pixels = context.getImageData(0, 0, node.width, node.height).data;
    let hash = 2166136261;
    for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619);
    return hash >>> 0;
  });
}

async function waitForPaint(canvas: Locator) {
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((node: HTMLCanvasElement) => {
        const pixels = node
          .getContext("2d")!
          .getImageData(0, 0, node.width, node.height).data;
        let visiblePixels = 0;
        for (let i = 3; i < pixels.length; i += 4)
          if (pixels[i] > 0) visiblePixels++;
        return visiblePixels;
      }),
    )
    .toBeGreaterThan(100);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`Uncaught: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`Console: ${message.text()}`);
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every pulse has a story." }),
  ).toBeVisible();
  await waitForPaint(ppg(page));
  await page.getByRole("button", { name: "Experiment", exact: true }).click();
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByRole("button", { name: "Sites", exact: true }).click();
  await page
    .getByRole("button", { name: "Close view options", exact: true })
    .click();
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = browserErrors.get(page) ?? [];
  await testInfo.attach("browser-errors.json", {
    body: JSON.stringify({ count: errors.length, errors }, null, 2),
    contentType: "application/json",
  });
  expect(
    errors,
    "No browser console errors or uncaught page exceptions",
  ).toEqual([]);
});

test("selecting sensing sites updates the signal and selected control", async ({
  page,
}) => {
  await page.getByRole("button", { name: "View options", exact: true }).click();
  const sites = page.getByRole("group", { name: "PPG sensing sites" });
  await expect(ppg(page)).toHaveAttribute("aria-label", /at the wrist/);
  await expect(
    sites.getByRole("button", { name: /Top of wrist/ }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const name of [
    "Top of wrist",
    "Carotid / neck",
    "Great toe",
    "Index finger",
  ]) {
    const button = sites.getByRole("button", { name: new RegExp(name) });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(sites.getByRole("button", { pressed: true })).toHaveCount(1);
  }
  await sites.getByRole("button", { name: /Top of wrist/ }).click();
  await expect(ppg(page)).toHaveAttribute("aria-label", /at the wrist/);
});

test("body hotspots, anatomy layers, and chest camera controls work together", async ({
  page,
}, testInfo) => {
  const anatomy = page.getByTestId("anatomy-canvas");
  const drawCalls = async () =>
    Number(await anatomy.getAttribute("data-draw-calls"));
  await expect(anatomy).toHaveAttribute("data-body-loaded", "true");
  await expect(anatomy).toHaveAttribute(
    "data-anatomy-source",
    "BodyParts3D 4.0",
  );
  await expect.poll(drawCalls).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Select Upper arm on body", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Upper arm", exact: true }),
  ).toBeVisible();
  await expect(ppg(page)).toHaveAttribute("aria-label", /at the upperarm/);

  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.waitForTimeout(200);
  const renderedBody = anatomy.locator("canvas");
  await expect(
    page.getByRole("button", { name: "Blue body glow", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Surface", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "X-ray", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  const cutaway = page.getByRole("button", {
    name: "Chest cutaway",
    exact: true,
  });
  await expect(cutaway).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(100);
  const openChest = await renderedBody.screenshot();
  await cutaway.click();
  await expect(cutaway).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () =>
      Buffer.compare(await renderedBody.screenshot(), openChest),
    )
    .not.toBe(0);
  await cutaway.click();
  await expect(cutaway).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const muscles = page.getByRole("switch", {
    name: "Muscle anatomy",
    exact: true,
  });
  const musclesInitiallyEnabled = await muscles.getAttribute("aria-checked");
  await muscles.click();
  await expect(muscles).toHaveAttribute(
    "aria-checked",
    musclesInitiallyEnabled === "true" ? "false" : "true",
  );
  await muscles.click();
  await expect(muscles).toHaveAttribute(
    "aria-checked",
    musclesInitiallyEnabled!,
  );

  const initialCalls = await drawCalls();
  const lungs = page.getByRole("switch", {
    name: "Breathing lungs",
    exact: true,
  });
  const flow = page.getByRole("switch", {
    name: "Blood flow tracers",
    exact: true,
  });
  await expect(lungs).toBeChecked();
  await expect(flow).toBeChecked();
  await lungs.click();
  await flow.click();
  await expect(lungs).not.toBeChecked();
  await expect(flow).not.toBeChecked();
  await expect.poll(drawCalls).toBeLessThan(initialCalls);
  const reducedCalls = await drawCalls();
  await lungs.click();
  await flow.click();
  await expect(lungs).toBeChecked();
  await expect(flow).toBeChecked();
  await expect.poll(drawCalls).toBeGreaterThan(reducedCalls);
  await page
    .getByRole("button", { name: "Close view options", exact: true })
    .click();

  await page
    .getByRole("button", { name: "Heart & lungs", exact: true })
    .click();
  await expect.poll(drawCalls).toBeGreaterThan(0);
  await page.waitForTimeout(120);
  await anatomy.screenshot({
    path: testInfo.outputPath("heart-and-lungs-close-up.png"),
  });
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select Upper arm on body", exact: true }),
  ).toBeVisible();
  await expect.poll(drawCalls).toBeGreaterThan(0);
  await anatomy.screenshot({ path: testInfo.outputPath("camera-reset.png") });
});

test("the age dial changes the rendered waveform with keyboard input", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Single beat", exact: true }).click();
  await expect(ppg(page)).toHaveAttribute("aria-label", /single-cycle/);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.waitForTimeout(120); // Settle the last permitted animation frame.
  const age = page.getByRole("slider", { name: "Age", exact: true });
  const initialWaveform = await canvasHash(ppg(page));
  await age.focus();
  await age.press("ArrowRight");
  await expect(age).toHaveAttribute("aria-valuenow", "33");
  await expect.poll(() => canvasHash(ppg(page))).not.toBe(initialWaveform);
  await age.press("End");
  await expect(age).toHaveAttribute("aria-valuenow", "75");
  await age.press("ArrowRight");
  await expect(age).toHaveAttribute("aria-valuenow", "75");
});

test("anatomical view and heart detail retain the signal lab", async ({
  page,
}, testInfo) => {
  const anatomy = page.getByTestId("anatomy-canvas");
  await expect(anatomy).toHaveAttribute("data-body-loaded", "true");
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(anatomy).toHaveAttribute("data-heart-focus", "false");
  await page.waitForTimeout(250);
  const skin = await anatomy.locator("canvas").screenshot();
  await testInfo.attach("surface-view.png", {
    body: skin,
    contentType: "image/png",
  });

  const detail = page.getByRole("button", {
    name: "Heart detail",
    exact: true,
  });
  await detail.click();
  await expect(detail).toHaveAttribute("aria-pressed", "true");
  await expect(anatomy).toHaveAttribute("data-heart-focus", "true");
  await expect(
    page.getByRole("button", { name: "Chest cutaway", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(250);
  const cardiac = await anatomy.locator("canvas").screenshot();
  expect(cardiac.equals(skin)).toBe(false);
  await testInfo.attach("heart-detail.png", {
    body: cardiac,
    contentType: "image/png",
  });
  await expect(ppg(page)).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-valuenow", "72");

  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await anatomy.locator("canvas").screenshot()).equals(cardiac),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  await expect(anatomy).toHaveAttribute("data-heart-focus", "false");
  await expect(detail).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: "Select Upper arm on body", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Upper arm", exact: true }),
  ).toBeVisible();
});

test("pause freezes the live canvas and resume restarts the stream", async ({
  page,
}) => {
  const plot = ppg(page);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume simulation", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(120);
  const pausedImage = await canvasHash(plot);
  await page.waitForTimeout(250);
  expect(await canvasHash(plot)).toBe(pausedImage);
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect.poll(() => canvasHash(plot)).not.toBe(pausedImage);
});

test("pause freezes the actual running 3D anatomy and resume restarts its motion", async ({
  page,
}, testInfo) => {
  const anatomy = page.getByTestId("anatomy-canvas");
  const renderedBody = anatomy.locator("canvas");
  await expect(anatomy).toHaveAttribute("data-body-loaded", "true");
  await expect(anatomy).toHaveAttribute(
    "data-anatomy-source",
    "BodyParts3D 4.0",
  );
  await page
    .getByRole("group", { name: "Physical activity" })
    .getByRole("button", { name: "Run", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-valuenow", "142");
  await renderedBody.scrollIntoViewIfNeeded();
  const moving = await renderedBody.screenshot();
  await expect
    .poll(async () => Buffer.compare(await renderedBody.screenshot(), moving))
    .not.toBe(0);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume simulation", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(250); // Allow the last permitted render and camera damping to settle.
  const frozen = await renderedBody.screenshot();
  await page.waitForTimeout(300);
  expect(
    Buffer.compare(await renderedBody.screenshot(), frozen),
    "Gait, heartbeat, breathing and flow must share the paused clock",
  ).toBe(0);
  await testInfo.attach("paused-running-anatomy.png", {
    body: frozen,
    contentType: "image/png",
  });
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect
    .poll(async () => Buffer.compare(await renderedBody.screenshot(), frozen))
    .not.toBe(0);
});

test("breathing rate changes the live signal independently of heart rate", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.waitForTimeout(120);
  const restingSignal = await canvasHash(ppg(page));
  const breathingRate = page.getByRole("slider", {
    name: "Breathing rate",
    exact: true,
  });
  await expect(breathingRate).toHaveValue("16");
  await breathingRate.press("ArrowRight");
  await expect(breathingRate).toHaveValue("17");
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-valuenow", "72");
  await expect.poll(() => canvasHash(ppg(page))).not.toBe(restingSignal);
  await breathingRate.press("End");
  await expect(breathingRate).toHaveValue("36");
  await breathingRate.press("ArrowRight");
  await expect(breathingRate).toHaveValue("36");
});

test("a baseline remains saved as physiology changes and can be removed", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Single beat", exact: true }).click();
  await page
    .getByRole("button", { name: /Freeze a baseline to compare/ })
    .click();
  const comparison = page.getByRole("button", {
    name: "Comparing: Top of wrist · 32y · 72 bpm",
  });
  await expect(comparison).toBeVisible();
  await expect(ppg(page)).toHaveAttribute(
    "aria-label",
    /Dashed lavender trace/,
  );
  await page.getByRole("slider", { name: "Age", exact: true }).press("End");
  await expect(comparison).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-valuenow", "75");
  await comparison.click();
  await expect(
    page.getByRole("button", { name: /Freeze a baseline to compare/ }),
  ).toBeVisible();
  await expect(ppg(page)).not.toHaveAttribute(
    "aria-label",
    /Dashed lavender trace/,
  );
});

test("guided lessons configure young anatomy and an older comparison", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Understand", exact: true }).click();
  await page.getByRole("button", { name: /Guided lessons/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /A pulse is more than a peak/ })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-valuenow", "25");
  await expect(
    page.getByRole("slider", { name: "Arterial stiffness", exact: true }),
  ).toHaveValue("15");
  await expect(ppg(page)).toHaveAttribute("aria-label", /single-cycle/);
  await page.waitForTimeout(120);
  const youngWaveform = await canvasHash(ppg(page));

  await page.getByRole("button", { name: "Understand", exact: true }).click();
  await page.getByRole("button", { name: /Guided lessons/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Watch a pulse grow older/ })
    .click();
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-valuenow", "75");
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-valuenow", "72");
  await expect(
    page.getByRole("button", {
      name: "Comparing: Index finger · 25y · 72 bpm",
    }),
  ).toBeVisible();
  await expect(ppg(page)).toHaveAttribute(
    "aria-label",
    /single-cycle.*Dashed lavender trace/,
  );
  await expect.poll(() => canvasHash(ppg(page))).not.toBe(youngWaveform);
});

test("CSV export contains ten seconds of finite data and the selected physiology", async ({
  page,
}) => {
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page
    .getByRole("group", { name: "PPG sensing sites" })
    .getByRole("button", { name: /Top of wrist/ })
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("slider", { name: "Age", exact: true })
    .press("ArrowRight");
  const pendingDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export signal", exact: true })
    .click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe(
    "plethscape_wrist_72bpm_simulated.csv",
  );
  const filename = await download.path();
  expect(filename).toBeTruthy();
  const rows = (await readFile(filename!, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(","));
  expect(rows.shift()).toEqual([
    "time_s",
    "ppg_au",
    "accel_x_g",
    "accel_y_g",
    "accel_z_g",
    "site",
    "age_years",
    "heart_rate_bpm",
    "respiratory_rate_bpm",
    "stiffness_pct",
    "perfusion_pct",
    "noise_pct",
    "activity",
    "signal_origin",
    "instantaneous_hr_bpm",
    "previous_ibi_ms",
    "respiratory_phase",
    "rhythm",
    "pulse_deficit",
    "beat_kind",
  ]);
  expect(rows).toHaveLength(1250);
  expect(rows[0][0]).toBe("0.000");
  expect(rows.at(-1)![0]).toBe("9.992");
  const values = rows.map((row) => Number(row[1]));
  expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5);
  for (const [i, row] of rows.entries()) {
    expect(row).toHaveLength(20);
    expect(row.slice(17)).toEqual(["sinus", "false", "regular"]);
    expect(Number(row[0])).toBeCloseTo(i / 125, 3);
    expect(
      row
        .slice(0, 5)
        .every((value) => value !== "" && Number.isFinite(Number(value))),
    ).toBe(true);
    expect(row.slice(5, 14)).toEqual([
      "wrist",
      "33",
      "72",
      "16",
      "35",
      "72",
      "9",
      "rest",
      "synthetic_educational",
    ]);
    const physiology = { ...DEFAULT_PHYSIOLOGY, age: 33 };
    const cardiac = getCardiacState(i / 125, physiology);
    expect(Number(row[1])).toBeCloseTo(
      samplePPG(i / 125, physiology, "wrist"),
      5,
    );
    expect(Number(row[14])).toBeCloseTo(cardiac.heartRate, 5);
    expect(Number(row[15])).toBeCloseTo(cardiac.intervalMs, 5);
    expect(Number(row[16])).toBeCloseTo(cardiac.breathPhase, 5);
  }
});

test("live rate and breathing stay in sync with anatomy, freeze on pause, and retain the mean control", async ({
  page,
}) => {
  const scene = page.getByTestId("anatomy-canvas");
  const live = page.getByTestId("live-physiology");
  await expect(live).toBeVisible();
  const initial = await live.getAttribute("data-heart-rate");
  await expect
    .poll(() => live.getAttribute("data-heart-rate"))
    .not.toBe(initial);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.waitForTimeout(300);
  const rate = await live.getAttribute("data-heart-rate");
  const interval = await live.getAttribute("data-interval-ms");
  const phase = await scene.getAttribute("data-cardiac-phase");
  await page.waitForTimeout(400);
  expect(await live.getAttribute("data-heart-rate")).toBe(rate);
  expect(await live.getAttribute("data-interval-ms")).toBe(interval);
  expect(await scene.getAttribute("data-cardiac-phase")).toBe(phase);
  const time = Number(await scene.getAttribute("data-simulation-time"));
  const expected = getCardiacState(time, DEFAULT_PHYSIOLOGY);
  expect(Number(rate)).toBeCloseTo(expected.heartRate, 2);
  expect(Number(phase)).toBeCloseTo(expected.phase, 6);
  expect(Number(await scene.getAttribute("data-breath-expansion"))).toBeCloseTo(
    expected.breathExpansion,
    6,
  );
  const breathing = page.getByRole("slider", {
    name: "Breathing rate",
    exact: true,
  });
  await breathing.press("Home");
  await expect(breathing).toHaveValue("6");
  await expect
    .poll(async () => Number(await live.getAttribute("data-heart-rate")))
    .toBeCloseTo(
      getCardiacState(time, { ...DEFAULT_PHYSIOLOGY, respiratoryRate: 6 })
        .heartRate,
      2,
    );
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-valuenow", "72");
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  const resumed = await live.getAttribute("data-heart-rate");
  await expect
    .poll(() => live.getAttribute("data-heart-rate"))
    .not.toBe(resumed);
});

test("running reveals the accelerometer and produces live motion data", async ({
  page,
}) => {
  await page
    .getByRole("group", { name: "Physical activity" })
    .getByRole("button", { name: "Run", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-valuenow", "142");
  await expect(
    page.getByRole("heading", { name: "Simulated wrist acceleration" }),
  ).toBeVisible();
  const acceleration = page.getByRole("img", {
    name: /^Simulated three-axis accelerometer/,
  });
  await acceleration.scrollIntoViewIfNeeded();
  await waitForPaint(acceleration);
  const frame = await canvasHash(acceleration);
  await expect.poll(() => canvasHash(acceleration)).not.toBe(frame);
  await expect(
    page.getByRole("button", { name: "Hide motion signals" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Hide motion signals" }).click();
  await expect(acceleration).toHaveCount(0);
});

test("desktop and mobile layouts stay within the document viewport", async ({
  page,
}, testInfo) => {
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1100 });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        })),
      )
      .toEqual({ document: width, viewport: width });
    await expect(
      page.getByRole("heading", { name: "Every pulse has a story." }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(360);
  await page.screenshot({
    path: testInfo.outputPath("mobile-full-page.png"),
    fullPage: true,
  });
});

test("wearable selection preserves the camera and explicit close-ups support mesh picking", async ({
  page,
}, testInfo) => {
  const anatomy = page.getByTestId("anatomy-canvas");
  await expect(anatomy).toHaveAttribute("data-body-loaded", "true");
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  const canvas = anatomy.locator("canvas");
  for (const [id, device, siteName] of [
    ["wrist", "Sensor band", "Top of wrist"],
    ["finger", "Smart ring", "Index finger"],
    ["ear", "Sensor earring", "Earlobe"],
    ["forehead", "Forehead band", "Forehead"],
    ["carotid", "Neck patch", "Carotid / neck"],
    ["upperarm", "Bicep band", "Upper arm"],
    ["toe", "Toe band", "Great toe"],
  ]) {
    const selectionDistance = Number(
      await anatomy.getAttribute("data-camera-distance"),
    );
    await page
      .getByRole("button", { name: `Select ${device}`, exact: true })
      .click();
    await expect(anatomy).toHaveAttribute("data-device-focus", "none");
    await expect(
      page.getByRole("button", { name: `Select ${device}`, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const afterSelection = Number(
      await anatomy.getAttribute("data-camera-distance"),
    );
    expect(Math.abs(afterSelection - selectionDistance)).toBeLessThan(0.01);
    await page
      .getByRole("button", { name: "Inspect device", exact: true })
      .click();
    await expect(anatomy).toHaveAttribute("data-device-focus", id);
    await expect(ppg(page)).toHaveAttribute(
      "aria-label",
      new RegExp(`at the ${id}`),
    );
    await expect(
      page.getByRole("heading", { name: siteName, exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(550); // Settle the deliberate device inspection camera flight.
    const marker = page.getByRole("button", {
      name: `Select ${siteName} on body`,
      exact: true,
      includeHidden: true,
    });
    const point = {
      x: Number(await marker.getAttribute("data-mesh-x")),
      y: Number(await marker.getAttribute("data-mesh-y")),
    };
    await canvas.click({ position: point });
    await expect(anatomy).toHaveAttribute("data-last-picked-device", id);
    await anatomy.screenshot({
      path: testInfo.outputPath(`${id}-wearable.png`),
    });
  }
  await page
    .getByRole("button", { name: "Select Sensor band", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect device", exact: true })
    .click();
  await page.waitForTimeout(550);
  const bodyCalls = Number(await anatomy.getAttribute("data-draw-calls"));
  await page.getByRole("button", { name: "Optical side", exact: true }).click();
  await expect(anatomy).toHaveAttribute("data-device-isolated", "true");
  await expect
    .poll(async () => Number(await anatomy.getAttribute("data-draw-calls")))
    .toBeLessThan(bodyCalls);
  await page.waitForTimeout(550);
  await anatomy.screenshot({
    path: testInfo.outputPath("wrist-optical-side.png"),
  });
  await page.getByRole("button", { name: "On body", exact: true }).click();
  await expect(anatomy).toHaveAttribute("data-device-isolated", "false");
  await expect(ppg(page)).toHaveAttribute("aria-label", /at the wrist/);
  await page
    .getByRole("button", { name: "Return to full body", exact: true })
    .click();
  await expect(anatomy).toHaveAttribute("data-device-focus", "none");
  await expect(
    page.getByRole("button", { name: "Select Upper arm on body", exact: true }),
  ).toBeVisible();
});

test("off-center wheel zoom follows the body region and right-drag pans", async ({
  page,
}) => {
  const scene = page.locator("[data-body-loaded='true']");
  await expect(scene).toBeVisible();
  const canvas = scene.locator("canvas").first();
  const rect = (await canvas.boundingBox())!;
  const before = Number(await scene.getAttribute("data-camera-distance"));
  const targetBefore = (await scene.getAttribute("data-camera-target"))!;
  await page.mouse.move(
    rect.x + rect.width * 0.64,
    rect.y + rect.height * 0.34,
  );
  await page.mouse.wheel(0, -450);
  await expect
    .poll(async () => Number(await scene.getAttribute("data-camera-distance")))
    .toBeLessThan(before * 0.9);
  await expect(scene).not.toHaveAttribute("data-camera-target", targetBefore);
  const zoomTarget = (await scene.getAttribute("data-camera-target"))!;
  await page.mouse.down({ button: "right" });
  await page.mouse.move(
    rect.x + rect.width * 0.53,
    rect.y + rect.height * 0.43,
    { steps: 8 },
  );
  await page.mouse.up({ button: "right" });
  await expect(scene).not.toHaveAttribute("data-camera-target", zoomTarget);
  await expect(scene).toHaveAttribute("data-device-focus", "none");
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  await expect
    .poll(async () => Number(await scene.getAttribute("data-camera-distance")))
    .toBeGreaterThan(6);
});

test("two-finger pinch and pan zoom into a body region without selecting a device", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const scene = page.locator("[data-body-loaded='true']");
  await expect(scene).toBeVisible();
  const canvas = scene.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const rect = (await canvas.boundingBox())!;
  const before = Number(await scene.getAttribute("data-camera-distance"));
  const targetBefore = (await scene.getAttribute("data-camera-target"))!;
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 2,
  });
  const center = {
    x: rect.x + rect.width * 0.6,
    y: Math.min(620, Math.max(180, rect.y + rect.height * 0.48)),
  };
  const points = (spread: number, shift: number) => [
    { x: center.x - spread + shift, y: center.y - 8, id: 0 },
    { x: center.x + spread + shift, y: center.y + 8, id: 1 },
  ];
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(18, 0),
  });
  for (let i = 1; i <= 8; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: points(18 + i * 5, -i * 2),
    });
    await page.waitForTimeout(25);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(async () => Number(await scene.getAttribute("data-camera-distance")))
    .toBeLessThan(before * 0.8);
  await expect(scene).not.toHaveAttribute("data-camera-target", targetBefore);
  await expect(scene).toHaveAttribute("data-device-focus", "none");
  await client.detach();
});
