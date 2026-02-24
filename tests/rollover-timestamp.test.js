// Rollover timestamp preservation tests
import TimesheetDB from '../timesheetDb.js';
import store from '../timesheetStore.js';
import { mergeTasks, filterRelevantFileTasks } from '../syncEngine.js';

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

TestRunner.test('rollover: preserveTimestamp uses DB timestamp even when in-memory task has new Date()', async () => {
  // This is the core regression test for the bug where handleNewEntry creates a task stub
  // with lastModified: new Date() for a task that already exists in the DB with an older date.
  // The upsert then calls updateTask(stubWithTodayDate, { preserveTimestamp: true }).
  // With the old code, this incorrectly preserved today's date from the stub.
  // With the fix, updateTask reads the current DB timestamp and uses that instead.
  const yesterdayTimestamp = yesterdayAt(11, 0);
  const db = await TimesheetDB();

  await seedData({
    tasks: [
      {
        exid: 'STUB_BUG',
        description: 'Task with yesterday timestamp in DB',
        lastModified: yesterdayTimestamp,
        deleted: false
      }
    ]
  });

  // Simulate what handleNewEntry does: creates a stub with lastModified: new Date()
  // for a task that isn't in today's view but already exists in the DB.
  const stubWithTodayDate = {
    exid: 'STUB_BUG',
    id: Date.now(),
    mostRecentEntry: new Date(),
    total: 0,
    lastModified: new Date() // today's date - this is the bug trigger
  };

  // This is what persistState -> upsert calls when the task already exists in DB
  await db.updateTask(stubWithTodayDate, { preserveTimestamp: true });

  // Verify the DB still has yesterday's timestamp, not today's
  const allTasks = await db.getAllTasks();
  const storedTask = allTasks.find(t => t.exid === 'STUB_BUG');

  TestRunner.assert(storedTask, 'Task should exist in database');
  TestRunner.assertEquals(
    new Date(storedTask.lastModified).toISOString(),
    yesterdayTimestamp.toISOString(),
    'DB timestamp should be yesterday even though the in-memory stub had today\'s date'
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

TestRunner.test('rollover: full day simulation with 5 tasks and multiple entries', async () => {
  const db = await TimesheetDB();

  // Create 5 tasks with various timestamps from yesterday
  const tasks = [
    {
      exid: 'TASK1',
      description: 'Client meeting preparation',
      client: 'AcmeCorp',
      lastModified: yesterdayAt(9, 0),
      complete: true,
      deleted: false
    },
    {
      exid: 'TASK2',
      description: 'Code review',
      project: 'WebApp',
      lastModified: yesterdayAt(10, 30),
      complete: false,
      deleted: false
    },
    {
      exid: 'TASK3',
      description: 'Bug fixes',
      project: 'API',
      lastModified: yesterdayAt(13, 0),
      complete: true,
      deleted: false
    },
    {
      exid: 'TASK4',
      description: 'Documentation',
      lastModified: yesterdayAt(15, 0),
      complete: false,
      deleted: false
    },
    {
      exid: 'TASK5',
      description: 'Team standup',
      lastModified: yesterdayAt(16, 30),
      complete: true,
      deleted: false
    }
  ];

  // Create 4-5 entries for each task
  const entries = [
    // TASK1 entries (4 entries)
    { id: 'e1', task: 'TASK1', annotation: 'Research', start: yesterdayAt(9, 0), end: yesterdayAt(9, 45), lastModified: yesterdayAt(9, 45) },
    { id: 'e2', task: 'TASK1', annotation: 'Prep slides', start: yesterdayAt(9, 45), end: yesterdayAt(10, 30), lastModified: yesterdayAt(10, 30) },
    { id: 'e3', task: 'TASK1', annotation: 'Practice', start: yesterdayAt(10, 30), end: yesterdayAt(11, 0), lastModified: yesterdayAt(11, 0) },
    { id: 'e4', task: 'TASK1', annotation: 'Final review', start: yesterdayAt(11, 0), end: yesterdayAt(11, 15), lastModified: yesterdayAt(11, 15) },

    // TASK2 entries (5 entries)
    { id: 'e5', task: 'TASK2', annotation: 'Review PR #123', start: yesterdayAt(11, 15), end: yesterdayAt(11, 45), lastModified: yesterdayAt(11, 45) },
    { id: 'e6', task: 'TASK2', annotation: 'Test changes', start: yesterdayAt(11, 45), end: yesterdayAt(12, 15), lastModified: yesterdayAt(12, 15) },
    { id: 'e7', task: 'TASK2', annotation: 'Add comments', start: yesterdayAt(12, 15), end: yesterdayAt(12, 30), lastModified: yesterdayAt(12, 30) },
    { id: 'e8', task: 'TASK2', annotation: 'Review PR #124', start: yesterdayAt(12, 30), end: yesterdayAt(13, 0), lastModified: yesterdayAt(13, 0) },
    { id: 'e9', task: 'TASK2', annotation: 'Approve changes', start: yesterdayAt(13, 0), end: yesterdayAt(13, 15), lastModified: yesterdayAt(13, 15) },

    // TASK3 entries (4 entries)
    { id: 'e10', task: 'TASK3', annotation: 'Debug endpoint', start: yesterdayAt(14, 0), end: yesterdayAt(14, 45), lastModified: yesterdayAt(14, 45) },
    { id: 'e11', task: 'TASK3', annotation: 'Write test', start: yesterdayAt(14, 45), end: yesterdayAt(15, 15), lastModified: yesterdayAt(15, 15) },
    { id: 'e12', task: 'TASK3', annotation: 'Fix validation', start: yesterdayAt(15, 15), end: yesterdayAt(15, 45), lastModified: yesterdayAt(15, 45) },
    { id: 'e13', task: 'TASK3', annotation: 'Deploy fix', start: yesterdayAt(15, 45), end: yesterdayAt(16, 0), lastModified: yesterdayAt(16, 0) },

    // TASK4 entries (5 entries)
    { id: 'e14', task: 'TASK4', annotation: 'Update README', start: yesterdayAt(16, 0), end: yesterdayAt(16, 20), lastModified: yesterdayAt(16, 20) },
    { id: 'e15', task: 'TASK4', annotation: 'API docs', start: yesterdayAt(16, 20), end: yesterdayAt(16, 45), lastModified: yesterdayAt(16, 45) },
    { id: 'e16', task: 'TASK4', annotation: 'Code examples', start: yesterdayAt(16, 45), end: yesterdayAt(17, 10), lastModified: yesterdayAt(17, 10) },
    { id: 'e17', task: 'TASK4', annotation: 'Screenshots', start: yesterdayAt(17, 10), end: yesterdayAt(17, 25), lastModified: yesterdayAt(17, 25) },
    { id: 'e18', task: 'TASK4', annotation: 'Proofread', start: yesterdayAt(17, 25), end: yesterdayAt(17, 40), lastModified: yesterdayAt(17, 40) },

    // TASK5 entries (4 entries)
    { id: 'e19', task: 'TASK5', annotation: 'Daily standup', start: yesterdayAt(9, 30), end: yesterdayAt(9, 45), lastModified: yesterdayAt(9, 45) },
    { id: 'e20', task: 'TASK5', annotation: 'Sprint planning', start: yesterdayAt(13, 30), end: yesterdayAt(14, 0), lastModified: yesterdayAt(14, 0) },
    { id: 'e21', task: 'TASK5', annotation: 'Retro notes', start: yesterdayAt(14, 0), end: yesterdayAt(14, 15), lastModified: yesterdayAt(14, 15) },
    { id: 'e22', task: 'TASK5', annotation: 'Action items', start: yesterdayAt(14, 15), end: yesterdayAt(14, 30), lastModified: yesterdayAt(14, 30) }
  ];

  // Seed all data
  await seedData({ tasks, entries });

  // Verify data was seeded correctly
  const allTasksBefore = await db.getAllTasks();
  const allEntriesBefore = await db.getAllEntries();

  TestRunner.assertEquals(allTasksBefore.length, 5, 'Should have 5 tasks before rollover');
  TestRunner.assertEquals(allEntriesBefore.length, 22, 'Should have 22 entries before rollover');

  // Verify some tasks are marked complete
  const completeTasks = allTasksBefore.filter(t => t.complete);
  TestRunner.assertEquals(completeTasks.length, 3, 'Should have 3 completed tasks');

  // Simulate rollover - read today's state
  const todayState = await store.read();

  // After rollover, NO tasks from yesterday should be loaded
  TestRunner.assertEquals(
    todayState.tasks.length,
    0,
    'No tasks from yesterday should appear in today\'s state after rollover'
  );

  // After rollover, NO entries from yesterday should be loaded
  TestRunner.assertEquals(
    todayState.entries.length,
    0,
    'No entries from yesterday should appear in today\'s state after rollover'
  );

  // But verify all data still exists in database with original timestamps
  const allTasksAfter = await db.getAllTasks();
  const allEntriesAfter = await db.getAllEntries();

  TestRunner.assertEquals(
    allTasksAfter.length,
    5,
    'All 5 tasks should still exist in database after rollover'
  );

  TestRunner.assertEquals(
    allEntriesAfter.length,
    22,
    'All 22 entries should still exist in database after rollover'
  );

  // Verify timestamps were preserved for all tasks
  for (const originalTask of tasks) {
    const dbTask = allTasksAfter.find(t => t.exid === originalTask.exid);
    TestRunner.assert(dbTask, `Task ${originalTask.exid} should exist in database`);
    TestRunner.assertEquals(
      new Date(dbTask.lastModified).toISOString(),
      originalTask.lastModified.toISOString(),
      `Task ${originalTask.exid} timestamp should be preserved`
    );
    TestRunner.assertEquals(
      dbTask.complete,
      originalTask.complete,
      `Task ${originalTask.exid} complete status should be preserved`
    );
  }

  // Verify timestamps were preserved for all entries
  for (const originalEntry of entries) {
    const dbEntry = allEntriesAfter.find(e => e.id === originalEntry.id);
    TestRunner.assert(dbEntry, `Entry ${originalEntry.id} should exist in database`);
    TestRunner.assertEquals(
      new Date(dbEntry.lastModified).toISOString(),
      originalEntry.lastModified.toISOString(),
      `Entry ${originalEntry.id} timestamp should be preserved`
    );
  }

  // Verify that if we were to persist today's state, it wouldn't affect yesterday's data
  await store.write(todayState);

  const tasksAfterWrite = await db.getAllTasks();
  TestRunner.assertEquals(
    tasksAfterWrite.length,
    5,
    'Tasks should still exist after writing empty today state'
  );

  // Verify timestamps still preserved after write
  for (const originalTask of tasks) {
    const dbTask = tasksAfterWrite.find(t => t.exid === originalTask.exid);
    TestRunner.assertEquals(
      new Date(dbTask.lastModified).toISOString(),
      originalTask.lastModified.toISOString(),
      `Task ${originalTask.exid} timestamp should still be preserved after write`
    );
  }
});

TestRunner.test('ensure-entry-tasks: task with yesterday lastModified but today entry loads with full data', async () => {
  // Simulate the bug: task was last modified yesterday, but user has a new entry today.
  // After rollover (or page reload), getTasksModifiedToday() omits the task, but
  // _ensureEntryTasksLoaded should recover it with its full description from the DB.
  await seedData({
    tasks: [
      {
        exid: 'RECOVER_TASK',
        description: 'Task worked on again today',
        client: 'AcmeCorp',
        lastModified: yesterdayAt(14, 0),
        deleted: false
      }
    ],
    entries: [
      {
        id: 'recover_entry1',
        task: 'RECOVER_TASK',
        annotation: 'Back on it',
        start: todayAt(9, 0),
        end: todayAt(10, 0),
        lastModified: todayAt(10, 0),
        deleted: false
      }
    ]
  });

  // Simulate what initialize receives from store.read():
  // - tasks: [] because getTasksModifiedToday() filters out yesterday's lastModified
  // - entries: the today entry (has today's lastModified)
  const appContext = document.querySelector('app-context');
  await appContext.initialize({
    tasks: [],
    entries: [
      {
        id: 'recover_entry1',
        task: 'RECOVER_TASK',
        annotation: 'Back on it',
        start: todayAt(9, 0),
        end: todayAt(10, 0),
        lastModified: todayAt(10, 0)
      }
    ],
    settings: { timeSnapThreshold: 6 },
    newEntry: {},
    clients: [],
    currentTask: {},
    deleted: [],
    deletedTasks: []
  });

  await new Promise(r => setTimeout(r, 100));

  // Task should appear with its full description (not a minimal stub)
  const loadedTask = appContext.tasks.value.find(t => t.exid === 'RECOVER_TASK');
  TestRunner.assert(loadedTask, 'Task should appear in tasks list when it has entries today');
  TestRunner.assertEquals(
    loadedTask.description,
    'Task worked on again today',
    'Task should have its full description loaded from DB, not an empty stub'
  );
  TestRunner.assertEquals(
    loadedTask.client,
    'AcmeCorp',
    'Task should have its client data loaded from DB'
  );

  // DB lastModified should be updated to today (so the task appears after next reload too)
  const db = await TimesheetDB();
  const allTasks = await db.getAllTasks();
  const dbTask = allTasks.find(t => t.exid === 'RECOVER_TASK');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dbTaskDate = new Date(dbTask.lastModified);
  dbTaskDate.setHours(0, 0, 0, 0);
  TestRunner.assertEquals(
    dbTaskDate.toISOString(),
    today.toISOString(),
    'DB lastModified should be updated to today since the task has entries today'
  );
});

TestRunner.test('ensure-entry-tasks: task with yesterday lastModified and no today entries does NOT appear', async () => {
  await seedData({
    tasks: [
      {
        exid: 'OLD_TASK',
        description: 'Task only worked on yesterday',
        lastModified: yesterdayAt(16, 0),
        deleted: false
      }
    ],
    entries: [
      {
        id: 'old_entry1',
        task: 'OLD_TASK',
        annotation: 'Yesterday work',
        start: yesterdayAt(14, 0),
        end: yesterdayAt(15, 0),
        lastModified: yesterdayAt(15, 0),
        deleted: false
      }
    ]
  });

  // Initialize with no entries today and no tasks (both filtered by date)
  const appContext = document.querySelector('app-context');
  await appContext.initialize({
    tasks: [],
    entries: [],
    settings: { timeSnapThreshold: 6 },
    newEntry: {},
    clients: [],
    currentTask: {},
    deleted: [],
    deletedTasks: []
  });

  await new Promise(r => setTimeout(r, 100));

  // Task should NOT appear - it has no entries today
  const loadedTask = appContext.tasks.value.find(t => t.exid === 'OLD_TASK');
  TestRunner.assert(!loadedTask, 'Task with no entries today should NOT appear after rollover');
});

TestRunner.test('filesync rollover: filterRelevantFileTasks excludes old DB tasks from today\'s view', async () => {
  // This is the regression test for the bug where file sync would bypass the
  // daily rollover. After rollover appTasks is empty (no tasks modified today).
  // Without the fix, mergeTasks([], fileTasks) sets lastModified: new Date() on
  // every file task, making them all appear in today's view.
  //
  // The fix: filterRelevantFileTasks strips out file tasks that already exist in
  // the DB (old tasks from a previous day) and are NOT in today's appTasks.

  // Seed the DB with old tasks from yesterday
  await seedData({
    tasks: [
      { exid: 'FS_OLD1', description: 'Old task 1', lastModified: yesterdayAt(9, 0), deleted: false },
      { exid: 'FS_OLD2', description: 'Old task 2', lastModified: yesterdayAt(11, 0), deleted: false }
    ]
  });

  // Simulate what syncInbound receives: appTasks is empty after rollover
  const appTasks = [];
  const appTaskExids = new Set(appTasks.map(t => t.exid));

  // Build dbTaskExids from the DB (as syncInbound now does)
  const db = await TimesheetDB();
  const allDbTasks = await db.getAllTasks();
  const dbTaskExids = new Set(allDbTasks.map(t => t.exid));

  // File contains both old DB tasks and one genuinely new task
  const fileTasks = [
    { exid: 'FS_OLD1', description: 'Old task 1 from file' },
    { exid: 'FS_OLD2', description: 'Old task 2 from file' },
    { exid: 'FS_NEW1', description: 'Brand new task from file' }  // not in DB
  ];

  const relevant = filterRelevantFileTasks(fileTasks, appTaskExids, dbTaskExids);

  TestRunner.assertEquals(
    relevant.length,
    1,
    'Only the genuinely new file task should pass the filter'
  );
  TestRunner.assertEquals(
    relevant[0].exid,
    'FS_NEW1',
    'The new task should be the one that passes through'
  );

  // Confirm old tasks are excluded
  const hasOld1 = relevant.some(t => t.exid === 'FS_OLD1');
  const hasOld2 = relevant.some(t => t.exid === 'FS_OLD2');
  TestRunner.assert(!hasOld1, 'Old DB task FS_OLD1 should be filtered out');
  TestRunner.assert(!hasOld2, 'Old DB task FS_OLD2 should be filtered out');

  // After filtering, mergeTasks sees only the new task — old tasks stay out of today's view
  const merged = mergeTasks(appTasks, relevant);
  TestRunner.assertEquals(merged.length, 1, 'Only 1 task in today\'s view after merge');
  TestRunner.assertEquals(merged[0].exid, 'FS_NEW1', 'New task is in today\'s view');
});

TestRunner.test('filesync rollover: filterRelevantFileTasks keeps today tasks and new tasks', async () => {
  // When the user has been working today, file sync should still update their
  // today tasks' metadata AND add genuinely new file tasks.

  await seedData({
    tasks: [
      { exid: 'FS_TODAY1', description: 'Today task', lastModified: new Date(), deleted: false },
      { exid: 'FS_OLD3', description: 'Old task 3', lastModified: yesterdayAt(14, 0), deleted: false }
    ]
  });

  // appTasks has the today task (simulating real usage)
  const appTasks = [
    { exid: 'FS_TODAY1', description: 'Today task', lastModified: new Date() }
  ];
  const appTaskExids = new Set(appTasks.map(t => t.exid));

  const db = await TimesheetDB();
  const allDbTasks = await db.getAllTasks();
  const dbTaskExids = new Set(allDbTasks.map(t => t.exid));

  const fileTasks = [
    { exid: 'FS_TODAY1', description: 'Today task (updated in file)' }, // today's task
    { exid: 'FS_OLD3', description: 'Old task 3 from file' },           // old DB task
    { exid: 'FS_BRAND_NEW', description: 'New task added in file' }     // genuinely new
  ];

  const relevant = filterRelevantFileTasks(fileTasks, appTaskExids, dbTaskExids);

  // Should keep: FS_TODAY1 (in appTasks) and FS_BRAND_NEW (not in DB)
  // Should exclude: FS_OLD3 (in DB but not in today's appTasks)
  TestRunner.assertEquals(relevant.length, 2, 'Today task and new task should pass through');
  TestRunner.assert(relevant.some(t => t.exid === 'FS_TODAY1'), 'Today task should pass through');
  TestRunner.assert(relevant.some(t => t.exid === 'FS_BRAND_NEW'), 'New task should pass through');
  TestRunner.assert(!relevant.some(t => t.exid === 'FS_OLD3'), 'Old DB task should be filtered out');

  // The merged result should have the today task with updated metadata plus the new task
  const merged = mergeTasks(appTasks, relevant);
  const todayTask = merged.find(t => t.exid === 'FS_TODAY1');
  TestRunner.assertEquals(
    todayTask?.description,
    'Today task (updated in file)',
    'Today task description should be updated from file'
  );
});
