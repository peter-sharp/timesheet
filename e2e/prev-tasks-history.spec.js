// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, seedIndexedDB } = require('./helpers');

test.describe('Prev-Tasks History (excludes today\'s tasks)', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('prev-tasks datalist excludes tasks modified today', async ({ page }) => {
    // Create dates for testing
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Seed historical tasks (not modified today)
    await seedIndexedDB(page, {
      tasks: [
        {
          exid: 'HIST1',
          description: 'Historical task 1',
          project: 'oldproject',
          client: 'oldclient',
          lastModified: yesterday.toISOString(),
          deleted: false
        },
        {
          exid: 'HIST2',
          description: 'Historical task 2',
          project: 'oldproject2',
          client: 'oldclient2',
          lastModified: twoDaysAgo.toISOString(),
          deleted: false
        }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#tasks');
    await page.waitForTimeout(500);

    // Now add a task for today
    await addTask(page, { raw: '#TODAY1 Today task +newproject client:newclient' });
    await page.waitForTimeout(500);

    // Check prev-tasks datalist
    const options = await page.evaluate(() => {
      const datalist = document.querySelector('#prev-tasks');
      return Array.from(datalist?.querySelectorAll('option') || []).map(opt => opt.value);
    });

    // Historical tasks should be in the datalist
    expect(options.some(o => o.includes('#HIST1'))).toBe(true);
    expect(options.some(o => o.includes('#HIST2'))).toBe(true);

    // Today's task should NOT be in prev-tasks
    expect(options.some(o => o.includes('#TODAY1'))).toBe(false);
  });

  test('prev-tasks returns up to 500 historical tasks', async ({ page }) => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Create 502 historical tasks
    const historicalTasks = Array.from({ length: 502 }, (_, i) => ({
      exid: `HIST${i}`,
      description: `Historical task ${i}`,
      lastModified: new Date(twoDaysAgo.getTime() - i * 1000).toISOString(), // Stagger by seconds
      deleted: false
    }));

    await seedIndexedDB(page, { tasks: historicalTasks });
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#tasks');
    await page.waitForTimeout(500);

    const options = await page.evaluate(() => {
      const datalist = document.querySelector('#prev-tasks');
      return Array.from(datalist?.querySelectorAll('option') || []).map(opt => opt.value);
    });

    // Should return exactly 500 tasks (the limit)
    expect(options.length).toBe(500);
  });

  test('prev-tasks includes tasks from yesterday but not today', async ({ page }) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Seed one task from yesterday
    await seedIndexedDB(page, {
      tasks: [
        {
          exid: 'YEST1',
          description: 'Yesterday task',
          lastModified: yesterday.toISOString(),
          deleted: false
        }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#tasks');

    // Add a task today
    await addTask(page, { raw: '#TODAY2 Task created today' });
    await page.waitForTimeout(500);

    const options = await page.evaluate(() => {
      const datalist = document.querySelector('#prev-tasks');
      return Array.from(datalist?.querySelectorAll('option') || []).map(opt => opt.value);
    });

    // Yesterday's task should be included
    expect(options.some(o => o.includes('#YEST1'))).toBe(true);

    // Today's task should NOT be included
    expect(options.some(o => o.includes('#TODAY2'))).toBe(false);
  });

  test('prev-tasks excludes deleted tasks', async ({ page }) => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    await seedIndexedDB(page, {
      tasks: [
        {
          exid: 'ACTIVE1',
          description: 'Active historical task',
          lastModified: twoDaysAgo.toISOString(),
          deleted: false
        },
        {
          exid: 'DELETED1',
          description: 'Deleted historical task',
          lastModified: twoDaysAgo.toISOString(),
          deleted: true
        }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#tasks');
    await page.waitForTimeout(500);

    const options = await page.evaluate(() => {
      const datalist = document.querySelector('#prev-tasks');
      return Array.from(datalist?.querySelectorAll('option') || []).map(opt => opt.value);
    });

    // Active task should be in datalist
    expect(options.some(o => o.includes('#ACTIVE1'))).toBe(true);

    // Deleted task should NOT be in datalist
    expect(options.some(o => o.includes('#DELETED1'))).toBe(false);
  });
});
