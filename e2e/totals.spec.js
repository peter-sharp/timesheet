// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, addEntry, getTaskItems, seedIndexedDB } = require('./helpers');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

function todayAt(hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function yesterdayAt(hours, minutes) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

test.describe('Totals - Today Only (Phase 6)', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('timeline total reflects only today\'s entries', async ({ page }) => {
    await seedIndexedDB(page, {
      tasks: [
        { exid: 'T1', description: 'Task one', lastModified: new Date().toISOString(), deleted: false }
      ],
      entries: [
        // Yesterday: 1 hour (should NOT count)
        { id: 2001, task: 'T1', annotation: 'old work', start: yesterdayAt(9, 0), end: yesterdayAt(10, 0), lastModified: yesterday(), deleted: false },
        // Today: 2 hours (should count)
        { id: 2002, task: 'T1', annotation: 'new work', start: todayAt(9, 0), end: todayAt(11, 0), lastModified: new Date().toISOString(), deleted: false }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#time-entries');
    await page.waitForSelector('time-sheet', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Total should be 2 (hours), not 3
    const totalText = await page.locator('time-sheet output[name="durationTotal"]').textContent();
    expect(parseFloat(totalText?.trim())).toBe(2);
  });

  test('task-level total reflects only today\'s entries', async ({ page }) => {
    await seedIndexedDB(page, {
      tasks: [
        { exid: 'T2', description: 'Task two', lastModified: new Date().toISOString(), deleted: false }
      ],
      entries: [
        // Yesterday: 1.5 hours
        { id: 3001, task: 'T2', annotation: 'old', start: yesterdayAt(9, 0), end: yesterdayAt(10, 30), lastModified: yesterday(), deleted: false },
        // Today: 0.5 hours
        { id: 3002, task: 'T2', annotation: 'new', start: todayAt(14, 0), end: todayAt(14, 30), lastModified: new Date().toISOString(), deleted: false }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#tasks');
    await page.waitForTimeout(500);

    // Task total should be 0.5 (today's entry only)
    const taskTotal = await page.evaluate(() => {
      const el = document.querySelector('[data-exid="T2"] [data-task-total]');
      return el?.getAttribute('hours');
    });
    expect(parseFloat(taskTotal)).toBe(0.5);
  });

  test('gaps calculation uses only today\'s entries', async ({ page }) => {
    await seedIndexedDB(page, {
      tasks: [
        { exid: 'T3', description: 'Task three', lastModified: new Date().toISOString(), deleted: false }
      ],
      entries: [
        // Yesterday entries (should NOT affect gaps)
        { id: 4001, task: 'T3', annotation: 'old1', start: yesterdayAt(9, 0), end: yesterdayAt(10, 0), lastModified: yesterday(), deleted: false },
        // Today: two entries with a 1-hour gap between them
        { id: 4002, task: 'T3', annotation: 'morning', start: todayAt(9, 0), end: todayAt(10, 0), lastModified: new Date().toISOString(), deleted: false },
        { id: 4003, task: 'T3', annotation: 'afternoon', start: todayAt(11, 0), end: todayAt(12, 0), lastModified: new Date().toISOString(), deleted: false }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#time-entries');
    await page.waitForSelector('time-sheet', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Total work should be 2 hours (two 1-hour entries today)
    const totalText = await page.locator('time-sheet output[name="durationTotal"]').textContent();
    expect(parseFloat(totalText?.trim())).toBe(2);

    // Gaps element should exist and reflect today-only gap (1 hour)
    const gapDuration = await page.evaluate(() => {
      const el = document.querySelector('[data-durationTotalGaps]');
      return el?.getAttribute('duration');
    });
    // Gap duration is in milliseconds (1 hour = 3600000ms), rounded to 1dp in hours
    expect(parseFloat(gapDuration)).toBeGreaterThan(0);
  });
});
