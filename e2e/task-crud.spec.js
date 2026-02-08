// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, getTaskItems } = require('./helpers');

test.describe('Task CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    await page.goto('/#tasks');
  });

  test('create a task with description only', async ({ page }) => {
    await addTask(page, { raw: '#T001 Build login page client:acme' });

    const tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('T001');
    expect(tasks[0].client).toBe('acme');
    expect(tasks[0].description).toContain('Build login page');
  });

  test('create a task with explicit exid and client', async ({ page }) => {
    await addTask(page, { raw: 'Design homepage', exid: 'D001', client: 'bigcorp' });

    const tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('D001');
    expect(tasks[0].client).toBe('bigcorp');
  });

  test('create multiple tasks', async ({ page }) => {
    await addTask(page, { raw: '#A1 Task one' });
    await addTask(page, { raw: '#A2 Task two' });
    await addTask(page, { raw: '#A3 Task three' });

    const tasks = await getTaskItems(page);
    expect(tasks.length).toBe(3);
    const exids = tasks.map(t => t.exid);
    expect(exids).toContain('A1');
    expect(exids).toContain('A2');
    expect(exids).toContain('A3');
  });

  test('complete a task via checkbox', async ({ page }) => {
    await addTask(page, { raw: '#C1 Complete me' });

    // task-status uses shadow DOM — click the shadow checkbox via evaluate
    await page.evaluate(() => {
      const taskStatus = document.querySelector('[data-exid="C1"] task-status');
      const shadowCheckbox = taskStatus.shadowRoot.querySelector('input[type="checkbox"]');
      shadowCheckbox.click();
    });
    await page.waitForTimeout(300);

    // Verify the original checkbox is checked
    const checked = await page.evaluate(() => {
      return document.querySelector('[data-exid="C1"] input[name="complete"]').checked;
    });
    expect(checked).toBe(true);
  });

  test('soft delete a task', async ({ page }) => {
    await addTask(page, { raw: '#DEL1 Delete me' });

    // Verify task exists
    let tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);

    // Click delete button
    await page.click('[data-exid="DEL1"] button[name="delete"]');
    await page.waitForTimeout(200);

    // Verify task is gone
    tasks = await getTaskItems(page);
    expect(tasks.length).toBe(0);
  });

  test('deleted task does not reappear after reload', async ({ page }) => {
    await addTask(page, { raw: '#DEL2 Gone forever' });

    // Delete it
    await page.click('[data-exid="DEL2"] button[name="delete"]');
    await page.waitForTimeout(1000);

    // Reload and check
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]');
    await page.waitForTimeout(1000);

    const tasks = await getTaskItems(page);
    expect(tasks.length).toBe(0);
  });

  test('form clears after adding a task', async ({ page }) => {
    await addTask(page, { raw: '#CLR1 Clear form test' });

    const rawInput = page.locator('task-list input[name="taskRaw"]');
    await expect(rawInput).toHaveValue('');
  });
});
