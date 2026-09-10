import { expect, test } from "@playwright/test";

test("paused anatomy stops GPU draws and remains interactive", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const state = window as unknown as { draws: number };
    state.draws = 0;
    for (const proto of [
      WebGLRenderingContext.prototype,
      WebGL2RenderingContext.prototype,
    ]) {
      const draw = proto.drawElements;
      proto.drawElements = function (...args: Parameters<typeof draw>) {
        state.draws++;
        return draw.apply(this, args);
      };
    }
  });
  await page.goto("/");
  const scene = page.getByTestId("anatomy-canvas");
  await expect(scene).toHaveAttribute("data-body-loaded", "true", {
    timeout: 45000,
  });
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.waitForTimeout(1800);
  const count = () =>
    page.evaluate(() => (window as unknown as { draws: number }).draws);
  const before = await count();
  await page.waitForTimeout(700);
  expect(await count()).toBe(before);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(count).toBeGreaterThan(before);
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page
    .getByRole("button", { name: "Chest cutaway", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Chest cutaway", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  const resumed = await count();
  await expect.poll(count).toBeGreaterThan(resumed);
});

test("keyboard shortcuts and view options preserve focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to simulator", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace")).toBeFocused();
  const trigger = page.getByRole("button", {
    name: "View options",
    exact: true,
  });
  await trigger.click();
  await expect(
    page.getByRole("button", { name: "Close view options", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page
    .getByRole("group", { name: "Light wavelength", exact: true })
    .getByRole("button", { name: "Green" })
    .click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveAttribute("aria-describedby", /.+/);
});
