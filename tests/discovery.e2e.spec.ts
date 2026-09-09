import { expect, test, type Page } from "@playwright/test";

const errorsByPage = new WeakMap<Page, string[]>();
const quest = (page: Page) => page.locator(".discovery-quest");

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(
    quest(page).getByRole("button", { name: "Start expedition" }),
  ).toBeVisible();
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = errorsByPage.get(page) ?? [];
  await testInfo.attach("discovery-browser-errors.json", {
    body: JSON.stringify(errors),
    contentType: "application/json",
  });
  expect(errors, "No browser errors during guided exploration").toEqual([]);
});

test("discovery starts explicitly and survives free exploration and sidebar changes", async ({
  page,
}) => {
  const panel = quest(page);
  await page.getByRole("button", { name: "Sites", exact: true }).click();
  await page
    .getByRole("group", { name: "PPG sensing sites" })
    .getByRole("button", { name: /Top of wrist/ })
    .click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Start expedition" }),
  ).toBeVisible();
  await expect(panel.getByText(/of 3 sites discovered/)).toHaveCount(0);

  await panel.getByRole("button", { name: "Start expedition" }).click();
  await expect(panel.getByText(/1 of 3 sites discovered/)).toBeVisible();
  await panel.getByRole("button", { name: /Smart ring/ }).click();
  await expect(panel.getByText(/2 of 3 sites discovered/)).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Explore reflection" }),
  ).toBeDisabled();
  await panel
    .getByRole("button", { name: "Free explore", exact: true })
    .click();
  await expect(
    panel.getByText("Your expedition progress is saved for this visit."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await panel.getByRole("button", { name: "Guided play", exact: true }).click();
  await expect(panel.getByText(/2 of 3 sites discovered/)).toBeVisible();
});

test("the phone expedition requires real experiments and correctable explanations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = quest(page);
  await panel.getByRole("button", { name: "Start expedition" }).click();
  await panel.getByRole("button", { name: /Sensor band/ }).click();
  await panel.getByRole("button", { name: /Sensor earring/ }).click();
  await panel.getByRole("button", { name: "Explore reflection" }).click();

  const capture = panel.getByRole("button", { name: "2. Capture baseline" });
  const older = panel.getByRole("button", { name: "3. Try age 70" });
  const observedAge = panel.getByRole("checkbox", {
    name: "I compared the current contour with the saved baseline.",
  });
  await expect(capture).toBeDisabled();
  await expect(older).toBeDisabled();
  await panel
    .getByRole("radio", { name: "Later reflection; a deeper notch." })
    .check();
  await panel.getByRole("button", { name: "1. Prepare age 25" }).click();
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-valuenow", "25");
  await capture.click();
  await expect(
    page.getByRole("button", {
      name: /Comparing: Index finger · 25y · 72 bpm/,
    }),
  ).toBeVisible();
  await older.click();
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-valuenow", "70");
  await expect(observedAge).toBeEnabled();

  // A changed confounder must not pass the controlled age comparison.
  await page
    .getByRole("slider", { name: "Heart rate", exact: true })
    .press("ArrowRight");
  await expect(observedAge).toBeDisabled();
  await older.click();
  await observedAge.check();
  await expect(
    panel.getByText(/Look at the timing of the reflected rise/),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Explore rhythm" }),
  ).toBeDisabled();
  await panel
    .getByRole("radio", { name: "Later reflection; a deeper notch." })
    .press("ArrowUp");
  await expect(
    panel.getByRole("radio", {
      name: "Earlier reflection; a less distinct notch.",
    }),
  ).toBeChecked();
  await panel.getByRole("button", { name: "Explore rhythm" }).click();

  const observedRate = panel.getByRole("checkbox", {
    name: "I compared the timing at 120 bpm or more.",
  });
  await expect(observedRate).toBeDisabled();
  await panel
    .getByRole("radio", { name: "The same timing; only taller peaks." })
    .check();
  await panel.getByRole("button", { name: "Try 120 bpm" }).click();
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-valuenow", "120");
  await expect(panel.locator(".dq-cycle-readout strong")).toContainText("0.50");
  await observedRate.check();
  await expect(panel.getByText(/Revisit the spacing/)).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Complete expedition" }),
  ).toBeDisabled();
  await panel
    .getByRole("radio", { name: "The same timing; only taller peaks." })
    .press("ArrowUp");
  await panel.getByRole("button", { name: "Complete expedition" }).click();
  await expect(panel.getByText("EXPEDITION COMPLETE · 3 / 3")).toBeVisible();
  await panel.getByRole("button", { name: "Restart expedition" }).click();
  await expect(
    panel.getByRole("button", { name: "Start expedition" }),
  ).toBeVisible();
  await expect(panel.getByText(/of 3 sites discovered/)).toHaveCount(0);
});

for (const width of [390, 820]) {
  test(`discovery controls fit the ${width}px layout without internal clipping`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    const panel = quest(page);
    await panel.getByRole("button", { name: "Start expedition" }).click();
    await panel.getByRole("button", { name: /Sensor band/ }).click();
    await panel.getByRole("button", { name: /Sensor earring/ }).click();
    await panel.getByRole("button", { name: "Explore reflection" }).click();
    const geometry = await panel.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const clipped = [...element.querySelectorAll("button, input, .dq-mode")]
        .filter((node) => node.getClientRects().length)
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
        })
        .map(
          (node) => node.textContent?.trim() || node.getAttribute("aria-label"),
        );
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        questWidth: element.clientWidth,
        contentWidth: element.scrollWidth,
        clipped,
      };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
    expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.questWidth + 1);
    expect(geometry.clipped).toEqual([]);
  });
}
