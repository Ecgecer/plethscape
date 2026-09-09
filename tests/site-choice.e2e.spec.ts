import { test, expect } from "@playwright/test";
for (const width of [1440, 390])
  test(`location lesson links evidence to real workspace actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    const learn = page.getByRole("button", { name: "Learn", exact: true });
    await learn.click();
    await page.getByRole("button", { name: /FEATURED EXPLORATION/ }).click();
    const dialog = page.getByRole("dialog", {
      name: "Choosing your PPG location",
    });
    await expect(
      dialog.getByRole("heading", {
        name: "Where should you measure your pulse?",
      }),
    ).toBeVisible();
    await dialog.getByText("What research found", { exact: true }).click();
    await expect(
      dialog.getByRole("link", { name: /six-site study/ }),
    ).toHaveAttribute("href", /PMC6412091/);
    await dialog.getByText("What research found", { exact: true }).click();
    await dialog.screenshot({ path: `artifacts/site-lesson-${width}.png` });
    await dialog.getByRole("button", { name: /Compare wrist/ }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Select Sensor band", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", {
        name: "Rest",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("slider", {
        name: "Heart rate",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveValue("72");
    await expect(
      page.getByRole("button", {
        name: "Comparing: Index finger · 32y · 72 bpm",
      }),
    ).toBeVisible();
    await learn.click();
    await expect(
      dialog.getByText("1 of 3 hands-on examples opened"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: /02.*Movement/ }).click();
    await dialog.getByRole("button", { name: /Try walking/ }).click();
    await expect(
      page.getByRole("button", {
        name: "Walk",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("slider", {
        name: "Heart rate",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveValue("98");
    await learn.click();
    await dialog.getByRole("button", { name: /03.*Everyday fit/ }).click();
    await dialog.getByRole("button", { name: "Sleep", exact: true }).click();
    await expect(dialog.getByText(/Consider overnight comfort/)).toBeVisible();
    await dialog.getByRole("button", { name: /04.*Why the wrist/ }).click();
    await expect(
      dialog.getByText(/requires comparative wear-time/),
    ).toBeVisible();
    await dialog.screenshot({
      path: `artifacts/site-lesson-wrist-${width}.png`,
    });
    expect(
      await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBeTruthy();
    await dialog
      .getByRole("button", { name: /Explore the wrist at rest/ })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Rest",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await learn.click();
    await expect(
      dialog.getByText("3 of 3 hands-on examples opened"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Learn through exploration" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
