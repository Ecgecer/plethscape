import { expect, test, type Page } from "@playwright/test";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", (e) => messages.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
  );
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function meshPoint(page: Page, site: string) {
  const scene = page.getByTestId("anatomy-canvas"),
    rect = (await scene.boundingBox())!;
  const marker = page.getByRole("button", {
    name: `Select ${site} on body`,
    exact: true,
  });
  return {
    x: rect.x + Number(await marker.getAttribute("data-mesh-x")),
    y: rect.y + Number(await marker.getAttribute("data-mesh-y")),
  };
}

for (const site of ["Forehead", "Top of wrist"])
  test(`scrolled phone pinch holds the ${site} under the fingers while zooming and panning`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    const scene = page.getByTestId("anatomy-canvas");
    await scene.evaluate((e) =>
      window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 70),
    );
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    const initial = await meshPoint(page, site);
    const before = Number(await scene.getAttribute("data-camera-distance"));
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 2,
    });
    const points = (spread: number, shift: number) => [
      { x: initial.x - spread + shift, y: initial.y, id: 0 },
      { x: initial.x + spread + shift, y: initial.y, id: 1 },
    ];
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points(18, 0),
    });
    await expect(scene).toHaveAttribute("data-zoom-anchor-source", "surface");
    const anchor = await scene.getAttribute("data-zoom-anchor-world");
    for (let i = 1; i <= 8; i++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points(18 + i * 3, -i * 1.5),
      });
      await page.waitForTimeout(25);
      const observed = await meshPoint(page, site);
      expect(
        Math.hypot(observed.x - (initial.x - i * 1.5), observed.y - initial.y),
      ).toBeLessThan(8);
      expect(await scene.getAttribute("data-zoom-anchor-world")).toBe(anchor);
    }
    // Lift and replace a finger without ending the gesture. This must preserve
    // the normal camera controls when both fingers are finally lifted.
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [points(42, -12)[0]],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points(42, -12),
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(
      Number(await scene.getAttribute("data-camera-distance")),
    ).toBeLessThan(before * 0.55);
    const released = await meshPoint(page, site);
    await page.waitForTimeout(350);
    const settled = await meshPoint(page, site);
    expect(
      Math.hypot(settled.x - released.x, settled.y - released.y),
    ).toBeLessThan(1);
    await expect(scene).toHaveAttribute("data-device-focus", "none");
    await expect(
      page.getByRole("button", { name: "Select Smart ring", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // A fresh drag still orbits after the pinch has ended.
    const position = (await scene.getAttribute("data-camera-position"))!;
    const box = (await scene.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, {
      steps: 5,
    });
    await page.mouse.up();
    await expect(scene).not.toHaveAttribute("data-camera-position", position);
    await client.detach();
  });

test("trackpad ctrl-wheel zoom anchors the head after scrolling and zooms back out cleanly", async ({
  page,
}) => {
  const scene = page.getByTestId("anatomy-canvas");
  await scene.scrollIntoViewIfNeeded();
  const initial = await meshPoint(page, "Forehead");
  const client = await page.context().newCDPSession(page);
  const before = Number(await scene.getAttribute("data-camera-distance"));
  for (let i = 0; i < 4; i++) {
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: initial.x,
      y: initial.y,
      deltaX: 0,
      deltaY: -22,
      modifiers: 2,
    });
    await page.waitForTimeout(30);
    const current = await meshPoint(page, "Forehead");
    expect(
      Math.hypot(current.x - initial.x, current.y - initial.y),
    ).toBeLessThan(8);
  }
  expect(Number(await scene.getAttribute("data-camera-distance"))).toBeLessThan(
    before * 0.6,
  );
  await expect(scene).toHaveAttribute("data-zoom-anchor-source", "surface");
  for (let i = 0; i < 4; i++)
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: initial.x,
      y: initial.y,
      deltaX: 0,
      deltaY: 22,
      modifiers: 2,
    });
  await page.waitForTimeout(350);
  const end = await meshPoint(page, "Forehead");
  expect(Math.hypot(end.x - initial.x, end.y - initial.y)).toBeLessThan(2);
  await client.detach();
});
