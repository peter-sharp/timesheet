// Rollover timestamp preservation tests
import TimesheetDB from '../timesheetDb.js';
import store from '../timesheetStore.js';

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

function yesterdayAt(hours, minutes) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function todayAt(hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

TestRunner.test('rollover: tasks from yesterday preserve their lastModified timestamp', async () => {
  const yesterdayTimestamp = yesterdayAt(14, 30);

  // Seed a task from yesterday with an entry from yesterday
  await seedData({
    tasks: [
      {
        exid: 'YEST1',
        description: 'Yesterday task',
        lastModified: yesterdayTimestamp,
        deleted: false
      }
    ],
    entries: [
      {
        id: 'entry1',
        task: 'YEST1',
        annotation: 'Working on yesterday task',
        start: yesterdayAt(14, 0),
        end: yesterdayAt(15, 0),
        lastModified: yesterdayTimestamp,
        deleted: false
      }
    ]
  });

  // Simulate rollover by reading state (which only loads today's data)
  const freshState = await store.read();

  // The task should NOT be in freshState since it's from yesterday
  TestRunner.assert(
    !freshState.tasks.some(t => t.exid === 'YEST1'),
    'Task from yesterday should not be in today\'s state'
  );

  // But verify it still exists in DB with original timestamp
  const db = await TimesheetDB();
  const allTasks = await db.getAllTasks();
  const storedTask = allTasks.find(t => t.exid === 'YEST1');

  TestRunner.assert(storedTask, 'Task should still exist in database');
  TestRunner.assertEquals(
    new Date(storedTask.lastModified).toISOString(),
    yesterdayTimestamp.toISOString(),
    'Task lastModified should still be yesterday\'s timestamp'
  );
});

TestRunner.test('rollover: entries removed but tasks keep original timestamps', async () => {
  const yesterdayTimestamp = yesterdayAt(10, 0);

  await seedData({
    tasks: [
      {
        exid: 'STABLE1',
        description: 'Stable task',
        lastModified: yesterdayTimestamp,
        deleted: false
      }
    ],
    entries: [
      {
        id: 'entry2',
        task: 'STABLE1',
        annotation: 'Old work',
        start: yesterdayAt(10, 0),
        end: yesterdayAt(11, 0),
        lastModified: yesterdayTimestamp,
        deleted: false
      }
    ]
  });

  // Read state which triggers the same logic as rollover
  const freshState = await store.read();

  // Entries from yesterday should not be loaded
  TestRunner.assertEquals(
    freshState.entries.length,
    0,
    'No entries from yesterday should be loaded'
  );

  // Verify task timestamp is preserved in DB
  const db = await TimesheetDB();
  const allTasks = await db.getAllTasks();
  const storedTask = allTasks.find(t => t.exid === 'STABLE1');

  TestRunner.assert(storedTask, 'Task should exist in database');
  TestRunner.assertEquals(
    new Date(storedTask.lastModified).toISOString(),
    yesterdayTimestamp.toISOString(),
    'Task lastModified should remain unchanged after entries are filtered out'
  );
});

TestRunner.test('rollover: writing yesterday task without new modifications preserves timestamp', async () => {
  const yesterdayTimestamp = yesterdayAt(9, 0);
  const db = await TimesheetDB();

  // Create a task from yesterday
  await seedData({
    tasks: [
      {
        exid: 'PRESERVE1',
        description: 'Should preserve timestamp',
        lastModified: yesterdayTimestamp,
        deleted: false
      }
    ]
  });

  // Verify initial timestamp
  let allTasks = await db.getAllTasks();
  let task = allTasks.find(t => t.exid === 'PRESERVE1');
  TestRunner.assertEquals(
    new Date(task.lastModified).toISOString(),
    yesterdayTimestamp.toISOString(),
    'Initial timestamp should be yesterday'
  );

  // Simulate what happens during persistState - update the task without actually modifying it
  await db.updateTask({
    ...task
  }, { preserveTimestamp: true });

  // Verify timestamp is still preserved
  allTasks = await db.getAllTasks();
  task = allTasks.find(t => t.exid === 'PRESERVE1');
  TestRunner.assertEquals(
    new Date(task.lastModified).toISOString(),
    yesterdayTimestamp.toISOString(),
    'Timestamp should be preserved after update with original lastModified'
  );
});

TestRunner.test('rollover: task modified today gets today timestamp', async () => {
  const yesterdayTimestamp = yesterdayAt(9, 0);
  const db = await TimesheetDB();

  // Create a task from yesterday
  await seedData({
    tasks: [
      {
        exid: 'MODIFY1',
        description: 'Will be modified today',
        lastModified: yesterdayTimestamp,
        deleted: false
      }
    ]
  });

  // Now modify it today (simulating a real user edit)
  const allTasks = await db.getAllTasks();
  const task = allTasks.find(t => t.exid === 'MODIFY1');

  // Update without passing lastModified - should get today's date
  await db.updateTask({
    ...task,
    description: 'Modified today'
    // Note: NOT passing lastModified
  });

  // Verify it now has today's timestamp
  const updatedTasks = await db.getAllTasks();
  const updatedTask = updatedTasks.find(t => t.exid === 'MODIFY1');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(updatedTask.lastModified);
  taskDate.setHours(0, 0, 0, 0);

  TestRunner.assertEquals(
    taskDate.toISOString(),
    today.toISOString(),
    'Modified task should have today\'s date'
  );
});
