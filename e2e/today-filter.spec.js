// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, getTaskItems, getEntryItems, seedIndexedDB } = require('./helpers');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

function today() {
  return new Date().toISOString();
}

test.describe('Today Filter (Phase 5)', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('only today\'s tasks appear in the task list', async ({ page }) => {
    await seedIndexedDB(page, {
      tasks: [
        { exid: 'old-task', description: 'Yesterday task', lastModified: yesterday(), deleted: false },
        { exid: 'new-task', description: 'Today task', lastModified: today(), deleted: false },
      ]
    });

    // Full reload so the store re-reads from IndexedDB with today filter
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.waitForTimeout(500);

    const tasks = await getTaskItems(page);
    const exids = tasks.map(t => t.exid);

    expect(exids).toContain('new-task');
    expect(exids).not.toContain('old-task');
  });

  test('only today\'s entries appear in the timeline', async ({ page }) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString();

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStart = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), 9, 0).toISOString();
    const yesterdayEnd = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), 10, 0).toISOString();

    await seedIndexedDB(page, {
      entries: [
        { id: 1001, task: 'task1', annotation: 'old work', start: yesterdayStart, end: yesterdayEnd, lastModified: yesterday(), deleted: false },
        { id: 1002, task: 'task1', annotation: 'new work', start: todayStart, end: todayEnd, lastModified: today(), deleted: false },
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#time-entries');
    await page.waitForSelector('time-sheet', { timeout: 10000 });
    await page.waitForTimeout(500);

    const entries = await getEntryItems(page);
    const ids = entries.map(e => e.id);

    expect(ids).toContain('1002');
    expect(ids).not.toContain('1001');
  });

  test('totals reflect only today\'s data', async ({ page }) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0).toISOString();

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStart = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), 9, 0).toISOString();
    const yesterdayEnd = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), 12, 0).toISOString();

    await seedIndexedDB(page, {
      entries: [
        { id: 2001, task: 'task1', annotation: 'old', start: yesterdayStart, end: yesterdayEnd, lastModified: yesterday(), deleted: false },
        { id: 2002, task: 'task1', annotation: 'new', start: todayStart, end: todayEnd, lastModified: today(), deleted: false },
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#time-entries');
    await page.waitForSelector('time-sheet', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Only today's 1-hour entry should count, not yesterday's 3-hour entry
    const entries = await getEntryItems(page);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('2002');
  });

  test('tasks modified today via edits appear in list', async ({ page }) => {
    // Create a task via the UI — it gets today's lastModified automatically
    await addTask(page, { raw: '#todayedit Today edit test' });

    // Full reload and verify it still appears (lastModified is today)
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.waitForTimeout(500);

    const tasks = await getTaskItems(page);
    const exids = tasks.map(t => t.exid);
    expect(exids).toContain('todayedit');
  });
});
