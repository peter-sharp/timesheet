// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp } = require('./helpers');

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('tasks page is visible by default', async ({ page }) => {
    const tasksSection = page.locator('#tasks');
    await expect(tasksSection).toBeVisible();
  });

  test('navigate to timeline via hash', async ({ page }) => {
    await page.goto('/#time-entries');
    await page.waitForTimeout(200);

    const timelineSection = page.locator('#time-entries');
    await expect(timelineSection).toBeVisible();
  });

  test('navigate to tasks via nav link', async ({ page }) => {
    // Start on timeline
    await page.goto('/#time-entries');
    await page.waitForTimeout(200);

    // Click tasks nav link
    await page.click('hash-nav a[href="#tasks"]');
    await page.waitForTimeout(200);

    const tasksSection = page.locator('#tasks');
    await expect(tasksSection).toBeVisible();
  });

  test('navigate to timeline via nav link', async ({ page }) => {
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    await page.click('hash-nav a[href="#time-entries"]');
    await page.waitForTimeout(200);

    const timelineSection = page.locator('#time-entries');
    await expect(timelineSection).toBeVisible();
  });

  test('no archive route exists', async ({ page }) => {
    await page.goto('/#archive');
    await page.waitForTimeout(200);

    // Archive section should not exist
    const archiveSection = page.locator('#archive');
    await expect(archiveSection).toHaveCount(0);
  });

  test('no settings route exists', async ({ page }) => {
    await page.goto('/#settings');
    await page.waitForTimeout(200);

    const settingsSection = page.locator('#settings');
    await expect(settingsSection).toHaveCount(0);
  });

  test('no sync route exists', async ({ page }) => {
    await page.goto('/#sync');
    await page.waitForTimeout(200);

    const syncSection = page.locator('#sync');
    await expect(syncSection).toHaveCount(0);
  });
});
