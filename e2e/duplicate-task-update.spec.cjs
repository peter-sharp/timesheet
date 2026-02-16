// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, getTaskItems } = require('./helpers.cjs');

test.describe('Duplicate Task Update', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    await page.goto('/#tasks');
  });

  test('adding a task with existing exid updates the task details', async ({ page }) => {
    // Add initial task
    await addTask(page, { raw: '#DUP1 Initial description client:acme' });

    let tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('DUP1');
    expect(tasks[0].description).toContain('Initial description');
    expect(tasks[0].client).toBe('acme');

    // Add task with same exid but different details
    await addTask(page, { raw: '#DUP1 Updated description client:bigcorp' });

    // Should still have only 1 task (not 2)
    tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);

    // Task details should be updated
    expect(tasks[0].exid).toBe('DUP1');
    expect(tasks[0].description).toContain('Updated description');
    expect(tasks[0].client).toBe('bigcorp');
  });

  test('adding a duplicate task via explicit exid updates existing task', async ({ page }) => {
    // Add initial task with explicit exid
    await addTask(page, { raw: 'First version', exid: 'EXPLICIT1', client: 'client1' });

    let tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('EXPLICIT1');
    expect(tasks[0].description).toContain('First version');
    expect(tasks[0].client).toBe('client1');

    // Add task with same explicit exid
    await addTask(page, { raw: 'Second version', exid: 'EXPLICIT1', client: 'client2' });

    // Should still have only 1 task
    tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);

    // Task details should be updated
    expect(tasks[0].exid).toBe('EXPLICIT1');
    expect(tasks[0].description).toContain('Second version');
    expect(tasks[0].client).toBe('client2');
  });

  test('batch adding tasks with duplicate exid updates existing tasks', async ({ page }) => {
    // Add initial task
    await addTask(page, { raw: '#BATCH1 Original +proj1 client:client1' });

    let tasks = await getTaskItems(page);
    expect(tasks.length).toBe(1);
    expect(tasks[0].exid).toBe('BATCH1');
    expect(tasks[0].project).toBe('proj1');

    // Batch add including duplicate
    const input = page.locator('task-list input[name="taskRaw"]');
    await input.fill('#BATCH1 Updated +proj2 client:client2\n#BATCH2 New task');
    await input.press('Enter');
    await page.waitForTimeout(300);

    // Should have 2 tasks (one updated, one new)
    tasks = await getTaskItems(page);
    expect(tasks.length).toBe(2);

    const batch1 = tasks.find(t => t.exid === 'BATCH1');
    expect(batch1.project).toBe('proj2');
    expect(batch1.client).toBe('client2');

    const batch2 = tasks.find(t => t.exid === 'BATCH2');
    expect(batch2).toBeDefined();
  });
});
