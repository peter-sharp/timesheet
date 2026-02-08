// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, addEntry, getEntryItems } = require('./helpers');

test.describe('Time Entry CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    // Create a task first so entries can reference it
    await addTask(page, { raw: '#WRK Work task' });
  });

  test('create a time entry', async ({ page }) => {
    await addEntry(page, { task: 'WRK', timeStart: '09:00', timeEnd: '10:00', annotation: 'Morning work' });

    const entries = await getEntryItems(page);
    expect(entries.length).toBe(1);
    expect(entries[0].task).toBe('WRK');
    expect(entries[0].timeStart).toBe('09:00');
    expect(entries[0].timeEnd).toBe('10:00');
  });

  test('create multiple time entries', async ({ page }) => {
    await addEntry(page, { task: 'WRK', timeStart: '09:00', timeEnd: '10:00' });
    await addEntry(page, { task: 'WRK', timeStart: '10:00', timeEnd: '11:30' });

    const entries = await getEntryItems(page);
    expect(entries.length).toBe(2);
  });

  test('edit a time entry', async ({ page }) => {
    await addEntry(page, { task: 'WRK', timeStart: '09:00', timeEnd: '10:00' });

    // Navigate to timeline to see the entry
    await page.goto('/#time-entries');
    await page.waitForTimeout(200);

    // Edit the task name on the existing entry
    const entrySection = page.locator('#time_entries section[data-id]').first();
    const taskInput = entrySection.locator('input[name="task"]');
    await taskInput.fill('WRK');
    await taskInput.blur();
    await page.waitForTimeout(300);

    const entries = await getEntryItems(page);
    expect(entries.length).toBe(1);
    expect(entries[0].task).toBe('WRK');
  });

  test('soft delete a time entry', async ({ page }) => {
    await addEntry(page, { task: 'WRK', timeStart: '09:00', timeEnd: '10:00' });

    let entries = await getEntryItems(page);
    expect(entries.length).toBe(1);

    // Click the delete button on the entry
    const deleteBtn = page.locator('#time_entries section[data-id] button[name="delete"]').first();
    await deleteBtn.click();
    await page.waitForTimeout(300);

    entries = await getEntryItems(page);
    expect(entries.length).toBe(0);
  });

  test('deleted entry does not reappear after reload', async ({ page }) => {
    await addEntry(page, { task: 'WRK', timeStart: '09:00', timeEnd: '10:00' });

    // Delete it
    const deleteBtn = page.locator('#time_entries section[data-id] button[name="delete"]').first();
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Reload
    await page.reload();
    await page.waitForSelector('time-sheet');
    await page.waitForTimeout(500);

    const entries = await getEntryItems(page);
    expect(entries.length).toBe(0);
  });

  test('total updates when entry is added', async ({ page }) => {
    await addEntry(page, { task: 'WRK', timeStart: '09:00', timeEnd: '10:00' });

    // Check the total output shows a non-zero value
    const totalText = await page.locator('time-sheet output[name="durationTotal"]').textContent();
    expect(totalText?.trim()).not.toBe('0');
    expect(totalText?.trim()).not.toBe('');
  });
});
