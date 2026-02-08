// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, getTaskItems } = require('./helpers');

test.describe('Batch Add Tasks (Phase 8)', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    await page.goto('/#tasks');
    await page.waitForSelector('task-list form[data-new-task]');
  });

  test('pasting multiple lines creates additional input rows', async ({ page }) => {
    const input = page.locator('task-list input[name="taskRaw"]');

    // Simulate multi-line paste
    await input.evaluate((el) => {
      const paste = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer()
      });
      paste.clipboardData.setData('text', '#T1 First task\n#T2 Second task\n#T3 Third task');
      el.dispatchEvent(paste);
    });
    await page.waitForTimeout(200);

    // Should have the primary input plus 2 extra rows
    const extraInputs = page.locator('task-list input[name="taskRawExtra"]');
    await expect(extraInputs).toHaveCount(2);

    // Primary input should have first line
    await expect(input).toHaveValue('#T1 First task');
  });

  test('Ctrl+Enter spawns a new empty input row', async ({ page }) => {
    const input = page.locator('task-list input[name="taskRaw"]');
    await input.fill('#T1 First task');
    await input.press('Control+Enter');
    await page.waitForTimeout(200);

    const extraInputs = page.locator('task-list input[name="taskRawExtra"]');
    await expect(extraInputs).toHaveCount(1);
    await expect(extraInputs.first()).toHaveValue('');
    await expect(extraInputs.first()).toBeFocused();
  });

  test('emptying an additional input row removes it', async ({ page }) => {
    const input = page.locator('task-list input[name="taskRaw"]');
    await input.fill('#T1 First task');
    await input.press('Control+Enter');
    await page.waitForTimeout(200);

    const extraInput = page.locator('task-list input[name="taskRawExtra"]').first();
    await extraInput.fill('temp');
    await page.waitForTimeout(100);
    await extraInput.fill('');
    await page.waitForTimeout(200);

    // Extra input should be removed
    await expect(page.locator('task-list input[name="taskRawExtra"]')).toHaveCount(0);
  });

  test('submitting with multiple rows creates multiple tasks', async ({ page }) => {
    const input = page.locator('task-list input[name="taskRaw"]');

    // Paste multiple lines
    await input.evaluate((el) => {
      const paste = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer()
      });
      paste.clipboardData.setData('text', '#B1 Batch one\n#B2 Batch two\n#B3 Batch three');
      el.dispatchEvent(paste);
    });
    await page.waitForTimeout(200);

    // Submit the form
    await page.click('task-list button[type="submit"]');
    await page.waitForTimeout(500);

    const tasks = await getTaskItems(page);
    expect(tasks.length).toBe(3);
    expect(tasks.map(t => t.exid)).toContain('B1');
    expect(tasks.map(t => t.exid)).toContain('B2');
    expect(tasks.map(t => t.exid)).toContain('B3');
  });

  test('single-line input still works as before', async ({ page }) => {
    const input = page.locator('task-list input[name="taskRaw"]');
    await input.fill('#S1 Single task client:testcorp');
    await page.click('task-list button[type="submit"]');
    await page.waitForTimeout(300);

    const tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('S1');
    expect(tasks[0].client).toBe('testcorp');
  });

  test('manual exid/client fields only apply for single input row', async ({ page }) => {
    const input = page.locator('task-list input[name="taskRaw"]');
    await input.fill('My task');

    // Open details and fill in manual exid/client
    await page.click('task-list details summary');
    await page.fill('task-list input[name="exid"]', 'MANUAL1');
    await page.fill('task-list input[name="client"]', 'manualclient');

    await page.click('task-list button[type="submit"]');
    await page.waitForTimeout(300);

    const tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('MANUAL1');
    expect(tasks[0].client).toBe('manualclient');
  });

  test('all input rows share the same datalist', async ({ page }) => {
    const input = page.locator('task-list input[name="taskRaw"]');
    await input.fill('#T1 Task');
    await input.press('Control+Enter');
    await page.waitForTimeout(200);

    const extraInput = page.locator('task-list input[name="taskRawExtra"]').first();
    const listAttr = await extraInput.getAttribute('list');
    expect(listAttr).toBe('prev-tasks');
  });

  test('extra inputs are cleared after successful submit', async ({ page }) => {
    const input = page.locator('task-list input[name="taskRaw"]');

    await input.evaluate((el) => {
      const paste = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer()
      });
      paste.clipboardData.setData('text', '#C1 Clear one\n#C2 Clear two');
      el.dispatchEvent(paste);
    });
    await page.waitForTimeout(200);

    await page.click('task-list button[type="submit"]');
    await page.waitForTimeout(300);

    // Extra inputs should be gone
    await expect(page.locator('task-list input[name="taskRawExtra"]')).toHaveCount(0);
    // Primary input should be empty
    await expect(input).toHaveValue('');
  });
});
