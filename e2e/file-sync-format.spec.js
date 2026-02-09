// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp } = require('./helpers');

test.describe('Todo.txt Format Conversion', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('taskToLine — incomplete task with all fields', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { taskToLine } = await import('/todoTxtFormat.js');
      return taskToLine({ exid: 'T001', description: 'Build login page', project: 'website', client: 'acme' });
    });
    expect(result).toBe('#T001 Build login page +website client:acme');
  });

  test('taskToLine — incomplete task with missing optional fields', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { taskToLine } = await import('/todoTxtFormat.js');
      return taskToLine({ exid: 'T002', description: 'Simple task' });
    });
    expect(result).toBe('#T002 Simple task');
  });

  test('taskToLine — completed task includes x YYYY-MM-DD prefix', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { taskToLine } = await import('/todoTxtFormat.js');
      return taskToLine({ exid: 'T003', description: 'Done task', project: 'proj', client: 'cli', complete: true, completedDate: '2026-02-08' });
    });
    expect(result).toBe('x 2026-02-08 #T003 Done task +proj client:cli');
  });

  test('lineToTask — parses line with #exid, +project, client:name', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { lineToTask } = await import('/todoTxtFormat.js');
      return lineToTask('#T001 Build login page +website client:acme');
    });
    expect(result.exid).toBe('T001');
    expect(result.description).toBe('Build login page');
    expect(result.project).toBe('website');
    expect(result.client).toBe('acme');
    expect(result.complete).toBe(false);
  });

  test('lineToTask — parses line with only description', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { lineToTask } = await import('/todoTxtFormat.js');
      return lineToTask('Just a plain task description');
    });
    expect(result.exid).toBeUndefined();
    expect(result.description).toBe('Just a plain task description');
    expect(result.project).toBe('');
    expect(result.client).toBe('');
    expect(result.complete).toBe(false);
  });

  test('lineToTask — parses completed line with x prefix', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { lineToTask } = await import('/todoTxtFormat.js');
      return lineToTask('x 2026-02-08 #T003 Done task +proj client:cli');
    });
    expect(result.exid).toBe('T003');
    expect(result.description).toBe('Done task');
    expect(result.project).toBe('proj');
    expect(result.client).toBe('cli');
    expect(result.complete).toBe(true);
    expect(result.completedDate).toBe('2026-02-08');
  });

  test('tasksToTodoTxt — filters out completed tasks, joins with newlines', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksToTodoTxt } = await import('/todoTxtFormat.js');
      return tasksToTodoTxt([
        { exid: 'A', description: 'Active', complete: false },
        { exid: 'B', description: 'Done', complete: true },
        { exid: 'C', description: 'Also active', complete: false }
      ]);
    });
    expect(result).toBe('#A Active\n#C Also active');
  });

  test('tasksToDoneTxt — filters out incomplete tasks, joins with newlines', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { tasksToDoneTxt } = await import('/todoTxtFormat.js');
      return tasksToDoneTxt([
        { exid: 'A', description: 'Active', complete: false },
        { exid: 'B', description: 'Done', complete: true, completedDate: '2026-01-15' }
      ]);
    });
    expect(result).toBe('x 2026-01-15 #B Done');
  });

  test('parseTodoTxt — handles empty lines and whitespace', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { parseTodoTxt } = await import('/todoTxtFormat.js');
      return parseTodoTxt('#A First task\n\n  \n#B Second task\n');
    });
    expect(result).toHaveLength(2);
    expect(result[0].exid).toBe('A');
    expect(result[1].exid).toBe('B');
  });

  test('round-trip: lineToTask(taskToLine(task)) preserves all fields', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { taskToLine, lineToTask } = await import('/todoTxtFormat.js');
      const original = { exid: 'RT1', description: 'Round trip test', project: 'myproj', client: 'mycli', complete: false };
      const line = taskToLine(original);
      const parsed = lineToTask(line);
      return { line, parsed };
    });
    expect(result.parsed.exid).toBe('RT1');
    expect(result.parsed.description).toBe('Round trip test');
    expect(result.parsed.project).toBe('myproj');
    expect(result.parsed.client).toBe('mycli');
    expect(result.parsed.complete).toBe(false);
  });
});
