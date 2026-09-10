import { expect, test } from "@playwright/test";

for (const width of [1440, 390])
  test(`appearance selector preserves physiology at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const scene = page.getByTestId("anatomy-canvas");
    await expect(scene).toHaveAttribute(
      "data-head-source",
      "Renderpeople Eric Rigged 001",
      { timeout: 30000 },
    );
    if (width < 768)
      await page
        .getByRole("button", { name: "Adjust physiology", exact: true })
        .click();
    await expect(
      page.getByRole("combobox", { name: "Model appearance" }),
    ).toHaveValue("male");
    await page
      .getByRole("combobox", { name: "Model appearance" })
      .selectOption("female");
    await expect(scene).toHaveAttribute(
      "data-head-source",
      "Renderpeople Claudia Rigged 002",
      { timeout: 30000 },
    );
    await expect(scene).toHaveAttribute("data-body-loaded", "true");
    if (width >= 768)
      await expect(
        page.getByRole("button", { name: "Inspect device", exact: true }),
      ).toBeEnabled();
    await expect(
      page.getByRole("combobox", { name: "Model appearance" }),
    ).toHaveValue("female");
    await page
      .getByRole("combobox", { name: "Model appearance" })
      .selectOption("male");
    await expect(scene).toHaveAttribute(
      "data-head-source",
      "Renderpeople Eric Rigged 001",
      { timeout: 30000 },
    );

    if (width < 768)
      await page
        .getByRole("button", { name: "See the signal", exact: false })
        .click();
    await expect(
      page.getByRole("heading", { name: "Top of wrist", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
