// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp } = require('./helpers');

test.describe('File Sync Merge Logic', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('new task in file only is added to app', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mergeTasks } = await import('/syncEngine.js');
      const appTasks = [{ exid: 'A', description: 'Existing' }];
      const fileTasks = [{ exid: 'B', description: 'From file', project: 'proj', client: '', complete: false }];
      return mergeTasks(appTasks, fileTasks);
    });
    expect(result).toHaveLength(2);
    expect(result.find(t => t.exid === 'B').description).toBe('From file');
  });

  test('task in both — file description overwrites app', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mergeTasks } = await import('/syncEngine.js');
      const appTasks = [{ exid: 'A', description: 'Old desc', total: 2.5 }];
      const fileTasks = [{ exid: 'A', description: 'Updated desc', project: '', client: '', complete: false }];
      return mergeTasks(appTasks, fileTasks);
    });
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Updated desc');
  });

  test('task in both — file marks complete', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mergeTasks } = await import('/syncEngine.js');
      const appTasks = [{ exid: 'A', description: 'Task', complete: false }];
      const fileTasks = [{ exid: 'A', description: 'Task', project: '', client: '', complete: true }];
      return mergeTasks(appTasks, fileTasks);
    });
    expect(result[0].complete).toBe(true);
  });

  test('task in app only (not in file) is preserved', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mergeTasks } = await import('/syncEngine.js');
      const appTasks = [
        { exid: 'A', description: 'In both' },
        { exid: 'B', description: 'App only' }
      ];
      const fileTasks = [{ exid: 'A', description: 'In both', project: '', client: '', complete: false }];
      return mergeTasks(appTasks, fileTasks);
    });
    expect(result).toHaveLength(2);
    expect(result.find(t => t.exid === 'B').description).toBe('App only');
  });

  test('completed task from done.txt is imported as complete', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mergeTasks } = await import('/syncEngine.js');
      const appTasks = [];
      const fileTasks = [{ exid: 'D1', description: 'Done task', project: '', client: '', complete: true }];
      return mergeTasks(appTasks, fileTasks);
    });
    expect(result).toHaveLength(1);
    expect(result[0].complete).toBe(true);
    expect(result[0].exid).toBe('D1');
  });

  test('task moved from todo.txt to done.txt updates to complete', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mergeTasks } = await import('/syncEngine.js');
      const appTasks = [{ exid: 'A', description: 'Was active', complete: false }];
      // Simulate: not in todo.txt, but in done.txt (complete: true from file)
      const fileTasks = [{ exid: 'A', description: 'Was active', project: '', client: '', complete: true }];
      return mergeTasks(appTasks, fileTasks);
    });
    expect(result[0].complete).toBe(true);
  });

  test('app time-tracking fields preserved after merge', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mergeTasks } = await import('/syncEngine.js');
      const appTasks = [{ exid: 'A', description: 'Task', total: 3.5, mostRecentEntry: '2026-02-08T10:00:00Z', timingState: 'stop' }];
      const fileTasks = [{ exid: 'A', description: 'Task updated', project: '', client: '', complete: false }];
      return mergeTasks(appTasks, fileTasks);
    });
    expect(result[0].total).toBe(3.5);
    expect(result[0].mostRecentEntry).toBe('2026-02-08T10:00:00Z');
    expect(result[0].timingState).toBe('stop');
    expect(result[0].description).toBe('Task updated');
  });

  test('empty file — existing app tasks preserved', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { mergeTasks } = await import('/syncEngine.js');
      const appTasks = [{ exid: 'A', description: 'Keep me' }];
      const fileTasks = [];
      return mergeTasks(appTasks, fileTasks);
    });
    expect(result).toHaveLength(1);
    expect(result[0].exid).toBe('A');
  });
});
