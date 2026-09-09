import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true });
const wave = (page: Page) =>
  page.getByRole("img", { name: /^Synthetic streaming PPG waveform/ });
const hash = async (page: Page) =>
  wave(page).evaluate((node) => {
    const c = node as HTMLCanvasElement;
    return c.toDataURL();
  });
async function openLab(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
  );
  await nav(page, "Experiment").click();
  await page.locator(".rhythm-lab > summary").click();
}
for (const width of [1440, 390])
  test(`rhythm examples, comparison and weak pulses work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openLab(page);
    const group = page.getByRole("group", { name: "Simulated rhythm" });
    for (const [name, id] of [
      ["AFib", "afib"],
      ["PACs", "pac"],
      ["PVCs", "pvc"],
      ["Bigeminy", "bigeminy"],
      ["Trigeminy", "trigeminy"],
    ]) {
      const button = group.getByRole("button", {
        name: new RegExp(`^${name} `),
      });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("live-physiology")).toHaveAttribute(
        "data-rhythm",
        id,
      );
      await expect(wave(page)).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Pause simulation", exact: true })
      .click();
    const original = await hash(page);
    await page
      .getByRole("checkbox", { name: "Show a weak peripheral pulse" })
      .check();
    await expect.poll(() => hash(page)).not.toBe(original);
    await page
      .getByRole("button", { name: "Compare with sinus rhythm", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Comparing:.*Sinus/ }),
    ).toBeVisible();
    await nav(page, "Understand").click();
    await expect(wave(page)).toBeVisible();
    await page
      .getByRole("button", { name: "Single beat", exact: true })
      .click();
    await expect(
      page.getByText(
        "Reference contour only · switch to Live stream to study this rhythm.",
      ),
    ).toBeVisible();
    await group.getByRole("button", { name: /^Sinus / }).click();
    await expect(page.getByTestId("live-physiology")).toHaveAttribute(
      "data-rhythm",
      "sinus",
    );
    await expect(
      page.getByRole("checkbox", { name: "Show a weak peripheral pulse" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });

test("export identifies the selected rhythm, optical deficit and actual beat classes", async ({
  page,
}) => {
  await openLab(page);
  await page
    .getByRole("group", { name: "Simulated rhythm" })
    .getByRole("button", { name: /^PVCs / })
    .click();
  await page
    .getByRole("checkbox", { name: "Show a weak peripheral pulse" })
    .check();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export signal", exact: true })
    .click();
  const download = await pending;
  const rows = (await readFile((await download.path())!, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((r) => r.split(","));
  const header = rows.shift()!;
  expect(header.slice(-3)).toEqual(["rhythm", "pulse_deficit", "beat_kind"]);
  expect(rows.every((r) => r[17] === "pvc" && r[18] === "true")).toBe(true);
  expect(new Set(rows.map((r) => r[19]))).toEqual(
    new Set(["regular", "premature", "recovery"]),
  );
});
