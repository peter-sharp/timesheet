// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, seedIndexedDB } = require('./helpers');

function yesterdayAt(hours, minutes) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

test.describe('Rollover Timestamp Preservation', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('tasks from yesterday should not have lastModified updated during rollover', async ({ page }) => {
    const yesterdayTimestamp = yesterdayAt(14, 30);
    
    // Seed a task from yesterday
    await seedIndexedDB(page, {
      tasks: [
        {
          exid: 'YEST1',
          description: 'Yesterday task',
          lastModified: yesterdayTimestamp,
          deleted: false
        }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Read the task back from IndexedDB and verify lastModified unchanged
    const storedTask = await page.evaluate(async () => {
      const request = indexedDB.open('timesheet', 6);
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction(['tasks'], 'readonly');
      const store = tx.objectStore('tasks');
      const index = store.index('exid');
      
      const task = await new Promise((resolve, reject) => {
        const req = index.get('YEST1');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      db.close();
      return task;
    });

    // The lastModified should still be yesterday's timestamp
    expect(new Date(storedTask.lastModified).toISOString()).toBe(yesterdayTimestamp);
  });

  test('rollover check should not modify task timestamps', async ({ page }) => {
    const yesterdayTimestamp = yesterdayAt(10, 0);
    
    await seedIndexedDB(page, {
      tasks: [
        {
          exid: 'STABLE1',
          description: 'Stable task',
          lastModified: yesterdayTimestamp,
          deleted: false
        }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    
    // Manually trigger rollover check via the app context
    await page.evaluate(() => {
      const appContext = document.querySelector('app-context');
      if (appContext._checkRollover) {
        appContext._checkRollover();
      }
    });
    
    await page.waitForTimeout(500);

    // Verify timestamp unchanged
    const storedTask = await page.evaluate(async () => {
      const request = indexedDB.open('timesheet', 6);
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction(['tasks'], 'readonly');
      const index = tx.objectStore('tasks').index('exid');
      
      const task = await new Promise((resolve, reject) => {
        const req = index.get('STABLE1');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      db.close();
      return task;
    });

    expect(new Date(storedTask.lastModified).toISOString()).toBe(yesterdayTimestamp);
  });

  test('yesterday tasks should disappear from UI after rollover without timestamp change', async ({ page }) => {
    const yesterdayTimestamp = yesterdayAt(9, 0);
    
    await seedIndexedDB(page, {
      tasks: [
        {
          exid: 'VANISH1',
          description: 'Should vanish',
          lastModified: yesterdayTimestamp,
          deleted: false
        }
      ]
    });

    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
    await page.goto('/#tasks');
    await page.waitForTimeout(500);

    // Task should NOT be visible in UI
    const taskItems = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-task-totals] li[data-exid]');
      return Array.from(items).map(li => li.dataset.exid);
    });

    expect(taskItems).not.toContain('VANISH1');

    // But verify it still exists in DB with original timestamp
    const storedTask = await page.evaluate(async () => {
      const request = indexedDB.open('timesheet', 6);
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction(['tasks'], 'readonly');
      const index = tx.objectStore('tasks').index('exid');
      
      const task = await new Promise((resolve, reject) => {
        const req = index.get('VANISH1');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      db.close();
      return task;
    });

    expect(storedTask).toBeTruthy();
    expect(new Date(storedTask.lastModified).toISOString()).toBe(yesterdayTimestamp);
  });
});
