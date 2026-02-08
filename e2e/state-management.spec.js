// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, addEntry, getTaskItems, getEntryItems } = require('./helpers');

test.describe('State Management', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('adding a task updates the UI reactively (no reload)', async ({ page }) => {
    await page.goto('/#tasks');
    await page.waitForSelector('task-list form[data-new-task]');

    // Verify empty
    let tasks = await getTaskItems(page);
    expect(tasks.length).toBe(0);

    // Add a task — should appear immediately
    await addTask(page, { raw: '#R1 Reactive task' });

    tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('R1');
  });

  test('tasks persist in IndexedDB across page reloads', async ({ page }) => {
    await addTask(page, { raw: '#P1 Persistent task' });

    // Reload the page
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]');
    await page.waitForTimeout(500);

    const tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('P1');
  });

  test('time entries persist in IndexedDB across page reloads', async ({ page }) => {
    await addTask(page, { raw: '#PE1 Entry persist' });
    await addEntry(page, { task: 'PE1', timeStart: '14:00', timeEnd: '15:00' });

    // Verify entry was created before reload
    let entries = await getEntryItems(page);
    expect(entries.length).toBe(1);

    // Wait for persistState to finish writing to IndexedDB
    await page.waitForTimeout(1000);

    // Reload on the timeline page
    await page.reload();
    await page.waitForSelector('time-sheet section[data-new="entry"]', { timeout: 10000 });
    await page.waitForTimeout(1500);

    entries = await getEntryItems(page);
    expect(entries.length).toBe(1);
    expect(entries[0].task).toBe('PE1');
  });

  test('starting a task via play button updates current task display', async ({ page }) => {
    await addTask(page, { raw: '#ST1 Start me' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Click the start/play button
    await page.click('[data-exid="ST1"] button[name="start"]');
    await page.waitForTimeout(300);

    // The stop button should now be visible
    const stopBtn = page.locator('[data-exid="ST1"] button[name="stop"]');
    await expect(stopBtn).toBeVisible();

    // current-task should show something
    const currentTask = page.locator('current-task');
    const text = await currentTask.textContent();
    expect(text).toBeTruthy();
  });

  test('stopping a task creates a time entry', async ({ page }) => {
    await addTask(page, { raw: '#STP1 Stop me' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Start the task
    await page.click('[data-exid="STP1"] button[name="start"]');
    await page.waitForTimeout(500);

    // Stop the task
    await page.click('[data-exid="STP1"] button[name="stop"]');
    await page.waitForTimeout(300);

    // Check timeline for the new entry
    await page.goto('/#time-entries');
    await page.waitForTimeout(300);

    const entries = await getEntryItems(page);
    expect(entries.length).toBe(1);
    expect(entries[0].task).toBe('STP1');
  });
});
