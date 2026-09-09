import { test, expect } from "@playwright/test";
for (const width of [1440, 390])
  test(`scanned head and head wearables survive locomotion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const asset = page.waitForResponse((response) =>
      response.url().endsWith("/models/scanned-head.glb"),
    );
    await page.goto("/");
    expect((await asset).status()).toBe(200);
    const scene = page.getByTestId("anatomy-canvas");
    await expect(scene).toHaveAttribute("data-body-loaded", "true");
    await expect(scene).toHaveAttribute(
      "data-head-source",
      "Renderpeople Eric Rigged 001",
    );
    if (width < 701)
      await page
        .getByRole("combobox", { name: "Wearable location" })
        .selectOption("forehead");
    else
      await page
        .getByRole("button", { name: "Select Temple sensor", exact: true })
        .click();
    await expect(scene).toHaveAttribute("data-region-focus", "forehead");
    for (const motion of ["Rest", "Walk", "Run"]) {
      if (width < 701)
        await page.getByRole("button", { name: "Adjust physiology" }).click();
      await page.getByRole("button", { name: motion, exact: true }).click();
      if (width < 701)
        await page.getByRole("button", { name: "See the signal →" }).click();
      await page.waitForTimeout(1600);
      await scene.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/head-${width}-${motion.toLowerCase()}.png`,
      });
      await expect(scene).toHaveAttribute("data-body-loaded", "true");
    }
    if (width < 701)
      await page
        .getByRole("combobox", { name: "Wearable location" })
        .selectOption("ear");
    else
      await page
        .getByRole("button", { name: "Select Sensor earring", exact: true })
        .click();
    await expect(scene).toHaveAttribute("data-region-focus", "ear");
    expect(errors).toEqual([]);
  });
