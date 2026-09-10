import { test, expect } from "@playwright/test";

for (const size of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`immersive stage keeps anatomy and instruments usable at ${size.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/");
    const scene = page.getByTestId("anatomy-canvas");
    await expect(scene).toHaveAttribute("data-body-loaded", "true");
    const bounds = await scene.boundingBox();
    expect(bounds!.width).toBeGreaterThan(size.width * 0.95);
    expect(bounds!.height).toBeGreaterThan(size.height * 0.8);
    await expect(page.locator(".signal-header h2")).toHaveText("Top of wrist");
    const rate = page
      .locator(".desktop-physiology")
      .getByRole("slider", { name: "Heart rate", exact: true });
    await rate.fill("110");
    await expect(rate).toHaveValue("110");
    await expect(page.locator(".signal-chart canvas")).toBeInViewport();
    await page
      .getByRole("button", { name: "Select Smart ring", exact: true })
      .click();
    await expect(page.locator(".signal-header h2")).toHaveText("Index finger");
    await page.getByRole("button", { name: "Immerse", exact: true }).click();
    await expect(page.locator(".control-rail")).toBeHidden();
    await expect(page.locator(".signal-panel")).toBeHidden();
    const target = await scene.getAttribute("data-camera-target");
    const rect = (await scene.boundingBox())!;
    await page.mouse.move(
      rect.x + rect.width * 0.52,
      rect.y + rect.height * 0.5,
    );
    await page.mouse.wheel(0, -120);
    await expect(scene).not.toHaveAttribute("data-camera-target", target!);
    await page
      .getByRole("button", { name: "Decorative atmosphere", exact: true })
      .click();
    await expect(scene).toHaveAttribute("data-atmosphere", "off");
    await page
      .getByRole("button", { name: "Show controls", exact: true })
      .click();
    await expect(page.locator(".signal-header h2")).toBeVisible();
    await expect(page.locator(".control-rail")).toBeVisible();
    await page
      .getByRole("button", { name: "Reset camera", exact: true })
      .click();
    await page.screenshot({ path: `artifacts/immersive-${size.width}.png` });
    expect(errors).toEqual([]);
  });
}

test("mobile prioritizes the body and waveform and retains physiology adjustment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
  );
  const body = (await page.locator(".body-panel").boundingBox())!;
  const signal = (await page.locator(".signal-panel").boundingBox())!;
  expect(body.y).toBeLessThan(signal.y);
  await page
    .getByRole("button", { name: "Adjust physiology", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const rate = dialog.getByRole("slider", { name: "Heart rate", exact: true });
  await rate.fill("120");
  await dialog.getByRole("button", { name: "See the signal" }).click();
  await expect(dialog).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
