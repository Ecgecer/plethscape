import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`Learn navigation and workspace return at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    if (viewport.width < 700) {
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await page.getByRole('button', { name: 'Learn through exploration', exact: true }).click();
    } else await page.getByRole('button', { name: 'Learn', exact: true }).click();
    const learn = page.locator('dialog.learning-page');
    await expect(learn).toBeVisible();
    const bounds = await learn.boundingBox();
    expect(bounds?.x).toBe(0);
    expect(bounds?.width).toBe(viewport.width);
    await expect(learn.getByRole('heading', { name: 'Get to know the signal.' })).toBeVisible();
    await page.screenshot({ path: `artifacts/learn-home-${viewport.width}.png` });
    await learn.locator('.learn-topic-card').filter({ hasText: 'Explore light and depth' }).click();
    await expect(learn.getByRole('heading', { name: 'Explore light and depth', exact: true })).toBeVisible();
    await expect(learn).toBeVisible();
    const preview = learn.locator('canvas');
    await expect(preview).toBeVisible();
    await learn.getByRole('button', { name: 'Red', exact: true }).click();
    await expect(learn.getByRole('button', { name: 'Red', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(learn.locator('.learn-feedback')).toContainText('What changed and why');
    await expect(learn.locator('.learn-feedback')).toContainText('Red represents deeper');
    await page.screenshot({ path: `artifacts/learn-lesson-${viewport.width}.png` });
    if (viewport.width < 700) await learn.getByRole('combobox', { name: 'Chapter' }).selectOption('science');
    else await learn.getByRole('button', { name: 'The science', exact: true }).click();
    await expect(learn.locator('.learning-reference')).toBeVisible();
    expect(await learn.locator('a[href*="sensorbio.com/the-signal"]').count()).toBeGreaterThan(0);
    expect(await learn.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/learn-science-${viewport.width}.png` });
    await learn.getByRole('button', { name: 'View model & sources' }).click();
    await expect(page.getByRole('heading', { name: 'The science behind the signal', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect(learn).toBeVisible();
    if (viewport.width < 700) await learn.getByRole('combobox', { name: 'Chapter' }).selectOption('wavelengths');
    else await learn.getByRole('button', { name: 'Explore light and depth', exact: true }).click();
    await expect(learn.getByRole('button', { name: 'Try in Workspace' })).toBeEnabled({timeout:60000});
    await learn.getByRole('button', { name: 'Try in Workspace' }).click();
    await expect(learn).not.toBeVisible();
    await page.getByRole('button', { name: 'Back to lesson', exact: true }).click();
    await expect(learn.getByRole('heading', { name: 'Explore light and depth', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(learn).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}
