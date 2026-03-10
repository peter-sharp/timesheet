// Tests for blank/timestamp-only task cleanup and prevention
import TimesheetDB from '../timesheetDb.js';

// Helper to clear and seed IndexedDB
async function seedData({ tasks = [], entries = [] }) {
  const db = await TimesheetDB();

  // Clear existing data
  const allTasks = await db.getAllTasks();
  for (const task of allTasks) {
    await db.permanentlyDeleteTask(task.exid);
  }

  const allEntries = await db.getAllEntries();
  for (const entry of allEntries) {
    await db.permanentlyDeleteEntry(entry.id);
  }

  // Add test data
  for (const task of tasks) {
    await db.addTask(task);
  }

  for (const entry of entries) {
    await db.addEntry(entry);
  }
}

TestRunner.test('cleanup: removes timestamp-only tasks with no description', async () => {
  await seedData({
    tasks: [
      { exid: '1772846833100', lastModified: new Date(), deleted: false },
      { exid: '1772846801543', lastModified: new Date(), deleted: false },
      { exid: 'VALID1', description: 'A real task', lastModified: new Date(), deleted: false }
    ]
  });

  const appContext = document.querySelector('app-context');
  const db = await TimesheetDB();
  await appContext._cleanupBlankTasks(db);

  const remaining = await db.getAllTasks();
  TestRunner.assertEquals(remaining.length, 1, 'Should have 1 task remaining after cleanup');
  TestRunner.assertEquals(remaining[0].exid, 'VALID1', 'Valid task should be preserved');
});

TestRunner.test('cleanup: keeps timestamp tasks that have entries, adds description', async () => {
  const timestampExid = '1772846833100';
  await seedData({
    tasks: [
      { exid: timestampExid, lastModified: new Date(), deleted: false },
      { exid: 'VALID1', description: 'A real task', lastModified: new Date(), deleted: false }
    ],
    entries: [
      {
        id: 'entry1',
        task: timestampExid,
        start: new Date(),
        end: new Date(),
        lastModified: new Date()
      }
    ]
  });

  const appContext = document.querySelector('app-context');
  const db = await TimesheetDB();
  await appContext._cleanupBlankTasks(db);

  const remaining = await db.getAllTasks();
  TestRunner.assertEquals(remaining.length, 2, 'Should keep both tasks (one has entries)');

  const keptTimestampTask = remaining.find(t => t.exid === timestampExid);
  TestRunner.assert(keptTimestampTask, 'Timestamp task with entries should be preserved');
  TestRunner.assertEquals(
    keptTimestampTask.description,
    `Task ${timestampExid}`,
    'Should add a description to preserved timestamp task'
  );
});

TestRunner.test('cleanup: preserves tasks with short numeric exids', async () => {
  // Short numeric exids (< 10 digits) are user-assigned, not timestamps
  await seedData({
    tasks: [
      { exid: '12345', lastModified: new Date(), deleted: false },
      { exid: '641333', description: 'MD renewal', lastModified: new Date(), deleted: false }
    ]
  });

  const appContext = document.querySelector('app-context');
  const db = await TimesheetDB();
  await appContext._cleanupBlankTasks(db);

  const remaining = await db.getAllTasks();
  TestRunner.assertEquals(remaining.length, 2, 'Short numeric exids should not be cleaned up');
});

TestRunner.test('handleNewEntry: does not create task for empty task name', async () => {
  await seedData({ tasks: [] });

  const appContext = document.querySelector('app-context');
  appContext.tasks.value = [];

  appContext.handleNewEntry({ task: '', annotation: '', start: null, end: null });
  TestRunner.assertEquals(appContext.tasks.value.length, 0, 'Empty task name should not create a task');

  appContext.handleNewEntry({ task: '   ', annotation: '', start: null, end: null });
  TestRunner.assertEquals(appContext.tasks.value.length, 0, 'Whitespace-only task name should not create a task');
});

TestRunner.test('handleNewEntry: creates task with description for valid task name', async () => {
  await seedData({ tasks: [] });

  const appContext = document.querySelector('app-context');
  appContext.tasks.value = [];

  appContext.handleNewEntry({ task: 'MY_TASK', annotation: '', start: null, end: null });
  TestRunner.assertEquals(appContext.tasks.value.length, 1, 'Should create one task');

  const created = appContext.tasks.value.find(t => t.exid === 'MY_TASK');
  TestRunner.assert(created, 'Task should exist with exid MY_TASK');
  TestRunner.assertEquals(created.description, 'MY_TASK', 'Task should have description set');
});
