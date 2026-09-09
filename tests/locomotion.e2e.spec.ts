import { expect, test } from "@playwright/test";

test("skeletal gait blends cadence, stops with pause, and returns to idle", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const scene = page.getByTestId("anatomy-canvas");
  await expect(scene).toHaveAttribute("data-body-loaded", "true");
  await expect(scene).toHaveAttribute("data-rig-joints", "21");
  await scene.scrollIntoViewIfNeeded();
  const cadence = async () =>
    Number(await scene.getAttribute("data-step-cadence"));
  const phase = async () => Number(await scene.getAttribute("data-gait-phase"));
  await page.getByRole("button", { name: "Walk", exact: true }).click();
  await expect.poll(cadence).toBe(1.8);
  const walking = await phase();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect.poll(cadence).toBe(2.65);
  expect(await phase()).toBeGreaterThan(walking);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.waitForTimeout(100);
  const paused = await phase();
  await page.waitForTimeout(250);
  expect(await phase()).toBe(paused);
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Rest", exact: true }).click();
  await expect.poll(cadence).toBe(0);
  const idle = await phase();
  await page.waitForTimeout(250);
  expect(Math.abs((await phase()) - idle)).toBeLessThan(1e-10);
  expect(errors).toEqual([]);
});
