// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, addTask, seedIndexedDB } = require('./helpers');

test.describe('Task Description Datalist (Phase 7)', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('task-list datalist populates with tasks from IndexedDB', async ({ page }) => {
    await seedIndexedDB(page, {
      tasks: [
        { exid: 'DL1', description: 'Design landing page', project: 'website', client: 'acme', lastModified: new Date().toISOString(), deleted: false },
        { exid: 'DL2', description: 'Build API', project: 'backend', client: 'bigcorp', lastModified: new Date().toISOString(), deleted: false }
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

    expect(options.length).toBe(2);
    expect(options.some(o => o.includes('#DL1'))).toBe(true);
    expect(options.some(o => o.includes('#DL2'))).toBe(true);
  });

  test('datalist options use todo.txt format', async ({ page }) => {
    await seedIndexedDB(page, {
      tasks: [
        { exid: 'FMT1', description: 'Format test', project: 'myproj', client: 'aclient', lastModified: new Date().toISOString(), deleted: false }
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

    expect(options.length).toBe(1);
    expect(options[0]).toBe('#FMT1 Format test +myproj client:aclient');
  });

  test('new tasks appear in datalist after adding', async ({ page }) => {
    await page.goto('/#tasks');
    await page.waitForSelector('task-list form[data-new-task]');

    await addTask(page, { raw: '#NEW1 New task +proj client:corp' });
    await page.waitForTimeout(300);

    const options = await page.evaluate(() => {
      const datalist = document.querySelector('#prev-tasks');
      return Array.from(datalist?.querySelectorAll('option') || []).map(opt => opt.value);
    });

    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options.some(o => o.includes('#NEW1'))).toBe(true);
    expect(options.some(o => o.includes('+proj'))).toBe(true);
    expect(options.some(o => o.includes('client:corp'))).toBe(true);
  });

  test('project field is parsed from +project syntax', async ({ page }) => {
    await addTask(page, { raw: '#PRJ1 Build feature +webapp client:testclient' });
    await page.waitForTimeout(300);

    // Verify the task was created (it should appear in task list)
    const tasks = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-task-totals] li[data-exid]');
      return Array.from(items).map(li => li.dataset.exid);
    });
    expect(tasks).toContain('PRJ1');

    // Verify datalist has the task with project in todo.txt format
    const options = await page.evaluate(() => {
      const datalist = document.querySelector('#prev-tasks');
      return Array.from(datalist?.querySelectorAll('option') || []).map(opt => opt.value);
    });
    expect(options.some(o => o.includes('+webapp'))).toBe(true);
  });
});
