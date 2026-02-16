// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask } = require('./helpers.cjs');

test.describe('Pie Progress Percentage', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('pie-progress shows correct percentage for focus interval progress', async ({ page }) => {
    // Set focus interval to 0.1 hours (6 minutes = 360 seconds) for faster testing
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('timesheet') || '{}');
      state.settings = { ...state.settings, focusInterval: 0.1 };
      localStorage.setItem('timesheet', JSON.stringify(state));
    });
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });

    // Add task and start it
    await addTask(page, { raw: '#PieTest1 Progress percentage test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Start the task
    await page.click('[data-exid="PieTest1"] button[name="start"]');
    await page.waitForTimeout(500);

    // Wait 3 seconds (should be 3/360 = 0.00833... of the focus interval)
    await page.waitForTimeout(3000);

    // Get the percentage attribute from pie-progress
    const percentAfter3Sec = await page.evaluate(() => {
      const pieProgress = document.querySelector('[data-exid="PieTest1"] pie-progress');
      return parseFloat(pieProgress?.getAttribute('percent') || '0');
    });

    // Calculate expected percentage: 3000ms / (0.1 hours * 3600000 ms/hour)
    // = 3000 / 360000 = 0.00833...
    const expectedPercent3Sec = 3000 / (0.1 * 3600000);

    // Allow 10% margin of error due to timing variations
    expect(percentAfter3Sec).toBeGreaterThan(expectedPercent3Sec * 0.9);
    expect(percentAfter3Sec).toBeLessThan(expectedPercent3Sec * 1.1 + 0.01);

    // The percentage should be small (less than 0.02 or 2%)
    expect(percentAfter3Sec).toBeLessThan(0.02);
  });

  test('pie-progress percentage increases over time', async ({ page }) => {
    // Set focus interval to 0.05 hours (3 minutes = 180 seconds)
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('timesheet') || '{}');
      state.settings = { ...state.settings, focusInterval: 0.05 };
      localStorage.setItem('timesheet', JSON.stringify(state));
    });
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });

    await addTask(page, { raw: '#PieTest2 Increasing percentage test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Start the task
    await page.click('[data-exid="PieTest2"] button[name="start"]');
    await page.waitForTimeout(500);

    // Get percentage at 1 second
    await page.waitForTimeout(1000);
    const percent1Sec = await page.evaluate(() => {
      const pieProgress = document.querySelector('[data-exid="PieTest2"] pie-progress');
      return parseFloat(pieProgress?.getAttribute('percent') || '0');
    });

    // Wait another 2 seconds (total 3 seconds)
    await page.waitForTimeout(2000);
    const percent3Sec = await page.evaluate(() => {
      const pieProgress = document.querySelector('[data-exid="PieTest2"] pie-progress');
      return parseFloat(pieProgress?.getAttribute('percent') || '0');
    });

    // Percentage at 3 seconds should be greater than at 1 second
    expect(percent3Sec).toBeGreaterThan(percent1Sec);

    // The ratio should be approximately 3:1 (allow 30% margin due to timing)
    const ratio = percent3Sec / percent1Sec;
    expect(ratio).toBeGreaterThan(2.0);
    expect(ratio).toBeLessThan(4.0);
  });

  test('pie-progress percentage near completion of focus interval', async ({ page }) => {
    // Set a very short focus interval for testing: 0.001 hours (3.6 seconds)
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('timesheet') || '{}');
      state.settings = { ...state.settings, focusInterval: 0.001 };
      localStorage.setItem('timesheet', JSON.stringify(state));
    });
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });

    await addTask(page, { raw: '#PieTest3 Near completion test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Start the task
    await page.click('[data-exid="PieTest3"] button[name="start"]');
    await page.waitForTimeout(500);

    // Wait 1.5 seconds (should be ~41.6% of the focus interval)
    await page.waitForTimeout(1500);
    const percent1_5Sec = await page.evaluate(() => {
      const pieProgress = document.querySelector('[data-exid="PieTest3"] pie-progress');
      return parseFloat(pieProgress?.getAttribute('percent') || '0');
    });

    // Expected: 1500ms / (0.001 hours * 3600000 ms/hour) = 1500 / 3600 = 0.4166...
    const expectedPercent = 1500 / (0.001 * 3600000);

    // Allow 15% margin
    expect(percent1_5Sec).toBeGreaterThan(expectedPercent * 0.85);
    expect(percent1_5Sec).toBeLessThan(expectedPercent * 1.15);

    // Should be around 0.4 (40%)
    expect(percent1_5Sec).toBeGreaterThan(0.35);
    expect(percent1_5Sec).toBeLessThan(0.50);

    // Wait until we pass the focus interval (total 3 seconds)
    await page.waitForTimeout(1500);
    const percent3Sec = await page.evaluate(() => {
      const pieProgress = document.querySelector('[data-exid="PieTest3"] pie-progress');
      return parseFloat(pieProgress?.getAttribute('percent') || '0');
    });

    // Should be around 0.83 (83%)
    expect(percent3Sec).toBeGreaterThan(0.75);
    expect(percent3Sec).toBeLessThan(0.95);
  });

  test('pie-progress percentage is 0 before starting task', async ({ page }) => {
    await addTask(page, { raw: '#PieTest4 Zero before start' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Check percentage before starting (task not started yet)
    const percentBefore = await page.evaluate(() => {
      const pieProgress = document.querySelector('[data-exid="PieTest4"] pie-progress');
      // The element might not be visible yet, check if it exists
      return pieProgress ? parseFloat(pieProgress.getAttribute('percent') || '0') : null;
    });

    // If pie-progress exists before start, it should be 0 or null (hidden)
    if (percentBefore !== null) {
      expect(percentBefore).toBe(0);
    }
  });

  test('pie-progress percentage calculation with default focus interval', async ({ page }) => {
    // Use default focus interval (0.4 hours = 24 minutes)
    await addTask(page, { raw: '#PieTest5 Default interval test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Start the task
    await page.click('[data-exid="PieTest5"] button[name="start"]');
    await page.waitForTimeout(500);

    // Wait 2 seconds
    await page.waitForTimeout(2000);
    const percent2Sec = await page.evaluate(() => {
      const pieProgress = document.querySelector('[data-exid="PieTest5"] pie-progress');
      return parseFloat(pieProgress?.getAttribute('percent') || '0');
    });

    // Expected: 2000ms / (0.4 hours * 3600000 ms/hour) = 2000 / 1440000 = 0.001388...
    const expectedPercent = 2000 / (0.4 * 3600000);

    // Allow 20% margin
    expect(percent2Sec).toBeGreaterThan(expectedPercent * 0.8);
    expect(percent2Sec).toBeLessThan(expectedPercent * 1.2 + 0.0005);

    // Should be very small (less than 0.3%)
    expect(percent2Sec).toBeLessThan(0.003);
  });

  test('pie-progress percentage does not exceed reasonable bounds', async ({ page }) => {
    // Set short focus interval for testing
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('timesheet') || '{}');
      state.settings = { ...state.settings, focusInterval: 0.002 };
      localStorage.setItem('timesheet', JSON.stringify(state));
    });
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });

    await addTask(page, { raw: '#PieTest6 Bounds test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Start the task
    await page.click('[data-exid="PieTest6"] button[name="start"]');
    await page.waitForTimeout(500);

    // Check percentage at various intervals
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(1000);
      const percent = await page.evaluate(() => {
        const pieProgress = document.querySelector('[data-exid="PieTest6"] pie-progress');
        return parseFloat(pieProgress?.getAttribute('percent') || '0');
      });

      // Percentage should never be negative
      expect(percent).toBeGreaterThanOrEqual(0);

      // Percentage should be reasonable (not astronomical due to calculation bug)
      // With the old bug: duration(ms) / formatDurationDecimal(hours) would give huge numbers
      // With the fix: duration(ms) / hoursToMilliseconds(hours) gives proper fraction
      expect(percent).toBeLessThan(10); // Should never exceed 1000%
    }
  });
});
