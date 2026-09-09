import { expect, test } from "@playwright/test";

test("the signal workspace remains usable when WebGL is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl") || type === "experimental-webgl")
        return null;
      return original.apply(this, [type, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await page.goto("/");
  const ring = page.getByRole("button", {
    name: "Select Smart ring",
    exact: true,
  });
  await expect(ring).toBeEnabled();
  await ring.click();
  await expect(ring).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("slider", { name: "Age", exact: true }).fill("65");
  const plot = page.getByRole("img", {
    name: /^Synthetic streaming PPG waveform at the finger/,
  });
  await expect(plot).toBeVisible();
  await expect
    .poll(() =>
      plot.evaluate((node) => {
        const c = node as HTMLCanvasElement;
        return c
          .getContext("2d")!
          .getImageData(0, 0, c.width, c.height)
          .data.some((v, i) => i % 4 === 3 && v > 0);
      }),
    )
    .toBe(true);
  await expect(page.locator(".signal-change-note")).toContainText(
    "Age changes",
  );
});
