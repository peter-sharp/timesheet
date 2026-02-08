// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, getEntryItems } = require('./helpers');

test.describe('Play / Pause', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('play button hides and stop button shows when task is started', async ({ page }) => {
    await addTask(page, { raw: '#PP1 Play pause test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    const playBtn = page.locator('[data-exid="PP1"] button[name="start"]');
    const stopBtn = page.locator('[data-exid="PP1"] button[name="stop"]');

    // Before starting: play visible, stop hidden
    await expect(playBtn).toBeVisible();
    await expect(stopBtn).toBeHidden();

    // Start the task
    await playBtn.click();
    await page.waitForTimeout(300);

    // After starting: play hidden, stop visible
    await expect(playBtn).toBeHidden();
    await expect(stopBtn).toBeVisible();
  });

  test('stop button hides and play button shows when task is stopped', async ({ page }) => {
    await addTask(page, { raw: '#PP2 Stop test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    const playBtn = page.locator('[data-exid="PP2"] button[name="start"]');
    const stopBtn = page.locator('[data-exid="PP2"] button[name="stop"]');

    // Start then stop
    await playBtn.click();
    await page.waitForTimeout(300);
    await stopBtn.click();
    await page.waitForTimeout(300);

    // After stopping: play visible, stop hidden
    await expect(playBtn).toBeVisible();
    await expect(stopBtn).toBeHidden();
  });

  test('current-task displays task description when started', async ({ page }) => {
    await addTask(page, { raw: '#PP3 My task description' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    await page.click('[data-exid="PP3"] button[name="start"]');
    await page.waitForTimeout(300);

    const text = await page.evaluate(() =>
      document.querySelector('current-task output[name="taskEXID"]').value
    );
    expect(text).toContain('PP3');
  });

  test('current-task clears when task is stopped', async ({ page }) => {
    await addTask(page, { raw: '#PP4 Clear test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    await page.click('[data-exid="PP4"] button[name="start"]');
    await page.waitForTimeout(300);
    await page.click('[data-exid="PP4"] button[name="stop"]');
    await page.waitForTimeout(300);

    const text = await page.evaluate(() =>
      document.querySelector('current-task output[name="taskEXID"]').value
    );
    expect(text).toBe('');
  });

  test('starting a second task auto-stops the first', async ({ page }) => {
    await addTask(page, { raw: '#PP5A First task' });
    await addTask(page, { raw: '#PP5B Second task' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Start first task
    await page.click('[data-exid="PP5A"] button[name="start"]');
    await page.waitForTimeout(500);

    // Start second task (should auto-stop first)
    await page.click('[data-exid="PP5B"] button[name="start"]');
    await page.waitForTimeout(500);

    // First task: play visible, stop hidden
    const playA = page.locator('[data-exid="PP5A"] button[name="start"]');
    const stopA = page.locator('[data-exid="PP5A"] button[name="stop"]');
    await expect(playA).toBeVisible();
    await expect(stopA).toBeHidden();

    // Second task: play hidden, stop visible
    const playB = page.locator('[data-exid="PP5B"] button[name="start"]');
    const stopB = page.locator('[data-exid="PP5B"] button[name="stop"]');
    await expect(playB).toBeHidden();
    await expect(stopB).toBeVisible();

    // A time entry should have been created for the first task
    await page.goto('/#time-entries');
    await page.waitForTimeout(300);
    const entries = await getEntryItems(page);
    expect(entries.length).toBe(1);
    expect(entries[0].task).toBe('PP5A');
  });

  test('stopping a task creates entry with correct task exid', async ({ page }) => {
    await addTask(page, { raw: '#PP6 Entry check' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    await page.click('[data-exid="PP6"] button[name="start"]');
    await page.waitForTimeout(500);
    await page.click('[data-exid="PP6"] button[name="stop"]');
    await page.waitForTimeout(300);

    await page.goto('/#time-entries');
    await page.waitForTimeout(300);

    const entries = await getEntryItems(page);
    expect(entries.length).toBe(1);
    expect(entries[0].task).toBe('PP6');
  });

  test('play/pause works with auto-generated exid (no #prefix)', async ({ page }) => {
    // Add task without #exid — gets a numeric Date.now() exid
    await addTask(page, { raw: 'Auto exid task' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Find the task item (only one task, so grab the first li)
    const taskItem = page.locator('[data-task-totals] li[data-exid]').first();
    const exid = await taskItem.getAttribute('data-exid');

    const playBtn = taskItem.locator('button[name="start"]');
    const stopBtn = taskItem.locator('button[name="stop"]');

    // Start the task
    await playBtn.click();
    await page.waitForTimeout(300);

    // Stop button should be visible, play hidden
    await expect(playBtn).toBeHidden();
    await expect(stopBtn).toBeVisible();

    // Stop the task
    await stopBtn.click();
    await page.waitForTimeout(300);

    // Play button should be visible, stop hidden
    await expect(playBtn).toBeVisible();
    await expect(stopBtn).toBeHidden();

    // Entry should exist with the auto-generated exid
    await page.goto('/#time-entries');
    await page.waitForTimeout(300);
    const entries = await getEntryItems(page);
    expect(entries.length).toBe(1);
    expect(entries[0].task).toBe(exid);
  });

  test('running task state persists across reload', async ({ page }) => {
    await addTask(page, { raw: '#PP7 Persist test' });
    await page.goto('/#tasks');
    await page.waitForTimeout(200);

    // Start the task
    await page.click('[data-exid="PP7"] button[name="start"]');
    await page.waitForTimeout(1000); // Allow persistState to write

    // Reload
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#tasks');
    await page.waitForTimeout(500);

    // Stop button should still be visible after reload
    const stopBtn = page.locator('[data-exid="PP7"] button[name="stop"]');
    await expect(stopBtn).toBeVisible();

    // Current task should still show the task
    const text = await page.evaluate(() =>
      document.querySelector('current-task output[name="taskEXID"]').value
    );
    expect(text).toContain('PP7');
  });
});
