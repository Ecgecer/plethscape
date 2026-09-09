import { expect, test, type Page } from "@playwright/test";
const errorsByPage = new WeakMap<Page, string[]>();
const nav = (page: Page, mode: string) =>
  page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: mode, exact: true });
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
  );
});
test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});

test("Explore starts with the body and a pulse journey that respects pause", async ({
  page,
}) => {
  await expect(nav(page, "Explore")).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export signal", exact: true }),
  ).toHaveCount(0);
  const journey = page.getByRole("region", { name: "Pulse journey" });
  await journey
    .getByRole("button", { name: "Follow a pulse", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "It begins with a beat.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select Sensor band", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.waitForTimeout(120);
  const scene = page.getByTestId("anatomy-canvas");
  const frozen = await scene.getAttribute("data-journey-progress");
  await page.waitForTimeout(350);
  expect(await scene.getAttribute("data-journey-progress")).toBe(frozen);
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "One heartbeat. Many perspectives.",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await journey.getByRole("button", { name: "Try a small experiment" }).click();
  await expect(nav(page, "Experiment")).toHaveAttribute("aria-current", "page");
});

test("one experiment at a time changes real physiology and preserves comparison across modes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "Experiment").click();
  const guide = page.getByRole("region", { name: "One experiment at a time" });
  for (const name of [
    "Discover index finger",
    "Discover top of wrist",
    "Discover earlobe",
  ])
    await guide.getByRole("button", { name, exact: true }).click();
  await expect(guide.getByText("3 of 3 sites found")).toBeVisible();
  await guide.getByRole("button", { name: "Next: a change in age" }).click();
  await expect(guide.getByRole("button", { name: "Try 120 bpm" })).toHaveCount(
    0,
  );
  await guide.getByRole("button", { name: "Save age 25" }).click();
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-valuenow", "25");
  await guide.getByRole("button", { name: "Now try age 70" }).click();
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-valuenow", "70");
  await expect(
    page.getByRole("button", {
      name: /Comparing: Index finger · 25y · 72 bpm/,
    }),
  ).toBeVisible();
  await page
    .getByRole("slider", { name: "Heart rate", exact: true })
    .press("ArrowRight");
  await expect(
    guide.getByRole("button", { name: "Next: change the rhythm" }),
  ).toBeDisabled();
  await guide
    .getByRole("button", { name: "Restore the age comparison" })
    .click();
  await guide.getByRole("button", { name: "Why does this happen?" }).click();
  await expect(nav(page, "Understand")).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText("What does PPG actually see?", { exact: true }),
  ).toBeVisible();
  await nav(page, "Experiment").click();
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-valuenow", "70");
  await guide.getByRole("button", { name: "Next: change the rhythm" }).click();
  await guide.getByRole("button", { name: "Try 120 bpm" }).click();
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-valuenow", "120");
  await guide.getByRole("button", { name: "Finish discoveries" }).click();
  await expect(
    guide.getByRole("heading", { name: "You’re finding the patterns." }),
  ).toBeVisible();
});

test("free selection stays in context and view options are secondary", async ({
  page,
}) => {
  const scene = page.getByTestId("anatomy-canvas");
  const distance = await scene.getAttribute("data-camera-distance");
  await page
    .getByRole("button", { name: "Select Sensor earring", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select Sensor earring", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(Number(await scene.getAttribute("data-camera-distance"))).toBeCloseTo(
    Number(distance),
    8,
  );
  await expect(
    page.getByRole("group", { name: "PPG sensing sites" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const nerves = page.getByRole("switch", {
    name: "Nervous system",
    exact: true,
  });
  await nerves.click();
  await expect(nerves).toHaveAttribute("aria-checked", "false");
  await page
    .getByRole("button", { name: "Close view options", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Nervous system", exact: true }),
  ).toHaveCount(0);
  await nav(page, "Understand").click();
  await nav(page, "Explore").click();
  await expect(
    page.getByRole("button", { name: "Select Sensor earring", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".discovery-count")).toContainText("1 / 7");
});

for (const width of [360, 820])
  test(`all three areas fit and remain readable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ["Explore", "Experiment", "Understand"]) {
      await nav(page, mode).click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBe(width);
      await expect(nav(page, mode)).toHaveAttribute("aria-current", "page");
      expect(
        await nav(page, mode).evaluate((e) =>
          parseFloat(getComputedStyle(e).fontSize),
        ),
      ).toBeGreaterThanOrEqual(16);
    }
    await page.screenshot({
      path: info.outputPath(`understand-${width}.png`),
      fullPage: true,
    });
  });
