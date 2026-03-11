// Lazy load (Option A: "Load previous day") tests
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

function daysAgo(days, hours, minutes) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function todayAt(hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// ── getEntriesByDay tests ──

TestRunner.test('getEntriesByDay: returns entries for a specific day', async () => {
  const twoDaysAgo = daysAgo(2, 9, 0);
  const twoDaysAgoEnd = daysAgo(2, 17, 0);

  await seedData({
    tasks: [
      { exid: 'TASK1', description: 'Task 1', lastModified: twoDaysAgo, deleted: false }
    ],
    entries: [
      {
        id: 'e1',
        task: 'TASK1',
        annotation: 'Work',
        start: twoDaysAgo,
        end: twoDaysAgoEnd,
        lastModified: twoDaysAgo,
        deleted: false
      },
      {
        id: 'e2',
        task: 'TASK1',
        annotation: 'Today work',
        start: todayAt(9, 0),
        end: todayAt(12, 0),
        lastModified: new Date(),
        deleted: false
      }
    ]
  });

  const db = await TimesheetDB();
  const result = await db.getEntriesByDay(twoDaysAgo);

  TestRunner.assertEquals(result.length, 1, 'Should return exactly 1 entry for that day');
  TestRunner.assertEquals(result[0].id, 'e1', 'Should return the correct entry');
});

TestRunner.test('getEntriesByDay: returns empty array for day with no entries', async () => {
  await seedData({
    entries: [
      {
        id: 'e1',
        task: 'TASK1',
        annotation: 'Work',
        start: todayAt(9, 0),
        end: todayAt(12, 0),
        lastModified: new Date(),
        deleted: false
      }
    ]
  });

  const db = await TimesheetDB();
  const tenDaysAgo = daysAgo(10, 12, 0);
  const result = await db.getEntriesByDay(tenDaysAgo);

  TestRunner.assertEquals(result.length, 0, 'Should return empty array for day with no entries');
});

TestRunner.test('getEntriesByDay: excludes soft-deleted entries', async () => {
  const yesterday = daysAgo(1, 9, 0);
  const yesterdayEnd = daysAgo(1, 17, 0);

  // addEntry always sets deleted: false, so we add then soft-delete
  await seedData({
    entries: [
      {
        id: 'del1',
        task: 'TASK1',
        annotation: 'Deleted entry',
        start: yesterday,
        end: yesterdayEnd,
        lastModified: yesterday
      },
      {
        id: 'e2',
        task: 'TASK1',
        annotation: 'Active entry',
        start: daysAgo(1, 10, 0),
        end: daysAgo(1, 11, 0),
        lastModified: yesterday
      }
    ]
  });

  // Soft-delete the first entry
  const db = await TimesheetDB();
  await db.deleteEntry('del1');

  const result = await db.getEntriesByDay(yesterday);

  TestRunner.assertEquals(result.length, 1, 'Should exclude deleted entries');
  TestRunner.assertEquals(result[0].id, 'e2', 'Should return only the non-deleted entry');
});

TestRunner.test('getEntriesByDay: returns multiple entries for the same day', async () => {
  const threeDaysAgo = daysAgo(3, 0, 0);

  await seedData({
    entries: [
      {
        id: 'e1',
        task: 'TASK1',
        annotation: 'Morning',
        start: daysAgo(3, 8, 0),
        end: daysAgo(3, 10, 0),
        lastModified: threeDaysAgo,
        deleted: false
      },
      {
        id: 'e2',
        task: 'TASK2',
        annotation: 'Afternoon',
        start: daysAgo(3, 13, 0),
        end: daysAgo(3, 17, 0),
        lastModified: threeDaysAgo,
        deleted: false
      },
      {
        id: 'e3',
        task: 'TASK1',
        annotation: 'Evening',
        start: daysAgo(3, 18, 0),
        end: daysAgo(3, 20, 0),
        lastModified: threeDaysAgo,
        deleted: false
      }
    ]
  });

  const db = await TimesheetDB();
  const result = await db.getEntriesByDay(threeDaysAgo);

  TestRunner.assertEquals(result.length, 3, 'Should return all 3 entries for that day');
});

// ── getPreviousDayWithEntries tests ──

TestRunner.test('getPreviousDayWithEntries: finds the previous day with data', async () => {
  const threeDaysAgo = daysAgo(3, 9, 0);

  await seedData({
    entries: [
      {
        id: 'e1',
        task: 'TASK1',
        annotation: 'Work',
        start: daysAgo(3, 9, 0),
        end: daysAgo(3, 12, 0),
        lastModified: threeDaysAgo,
        deleted: false
      },
      {
        id: 'e2',
        task: 'TASK1',
        annotation: 'Today',
        start: todayAt(9, 0),
        end: todayAt(12, 0),
        lastModified: new Date(),
        deleted: false
      }
    ]
  });

  const db = await TimesheetDB();
  const result = await db.getPreviousDayWithEntries(new Date());

  TestRunner.assert(result !== null, 'Should find a previous day');
  const expected = new Date(daysAgo(3, 0, 0));
  expected.setHours(0, 0, 0, 0);
  TestRunner.assertEquals(
    result.toDateString(),
    expected.toDateString(),
    'Should return the date 3 days ago'
  );
});

TestRunner.test('getPreviousDayWithEntries: returns null when no previous entries exist', async () => {
  await seedData({ entries: [] });

  const db = await TimesheetDB();
  const result = await db.getPreviousDayWithEntries(new Date());

  TestRunner.assertEquals(result, null, 'Should return null when no entries exist');
});

TestRunner.test('getPreviousDayWithEntries: skips days with only deleted entries', async () => {
  const fiveDaysAgo = daysAgo(5, 9, 0);

  // Use the same seedData helper but with unique IDs
  const db = await TimesheetDB();

  // Clear all existing data first
  const allEntries = await db.getAllEntries();
  for (const entry of allEntries) {
    await db.permanentlyDeleteEntry(entry.id);
  }
  // Also clear deleted entries
  const deletedEntries = [];
  for await (const entry of db.getDeletedEntries()) {
    deletedEntries.push(entry);
  }
  for (const entry of deletedEntries) {
    await db.permanentlyDeleteEntry(entry.id);
  }

  // Add two entries
  await db.addEntry({
    id: 'skip_del_1',
    task: 'TASK1',
    annotation: 'To be deleted',
    start: daysAgo(2, 9, 0),
    end: daysAgo(2, 12, 0),
    lastModified: daysAgo(2, 9, 0)
  });

  await db.addEntry({
    id: 'skip_active_1',
    task: 'TASK1',
    annotation: 'Active',
    start: daysAgo(5, 9, 0),
    end: daysAgo(5, 12, 0),
    lastModified: fiveDaysAgo
  });

  // Soft-delete the entry from 2 days ago
  await db.deleteEntry('skip_del_1');

  const result = await db.getPreviousDayWithEntries(new Date());

  TestRunner.assert(result !== null, 'Should find a day with non-deleted entries');
  const expected = new Date(daysAgo(5, 0, 0));
  expected.setHours(0, 0, 0, 0);
  TestRunner.assertEquals(
    result.toDateString(),
    expected.toDateString(),
    'Should skip deleted and return the day 5 days ago'
  );
});

TestRunner.test('getPreviousDayWithEntries: finds sequential days correctly', async () => {
  await seedData({
    entries: [
      {
        id: 'e1',
        task: 'TASK1',
        annotation: 'Day 1',
        start: daysAgo(1, 9, 0),
        end: daysAgo(1, 12, 0),
        lastModified: daysAgo(1, 9, 0),
        deleted: false
      },
      {
        id: 'e2',
        task: 'TASK1',
        annotation: 'Day 3',
        start: daysAgo(3, 9, 0),
        end: daysAgo(3, 12, 0),
        lastModified: daysAgo(3, 9, 0),
        deleted: false
      }
    ]
  });

  const db = await TimesheetDB();

  // First call: should find yesterday
  const first = await db.getPreviousDayWithEntries(new Date());
  TestRunner.assert(first !== null, 'Should find yesterday');
  const expectedFirst = daysAgo(1, 0, 0);
  expectedFirst.setHours(0, 0, 0, 0);
  TestRunner.assertEquals(
    first.toDateString(),
    expectedFirst.toDateString(),
    'First call should find yesterday'
  );

  // Second call: searching before yesterday should find 3 days ago
  const second = await db.getPreviousDayWithEntries(first);
  TestRunner.assert(second !== null, 'Should find 3 days ago');
  const expectedSecond = daysAgo(3, 0, 0);
  expectedSecond.setHours(0, 0, 0, 0);
  TestRunner.assertEquals(
    second.toDateString(),
    expectedSecond.toDateString(),
    'Second call should find 3 days ago'
  );
});

// ── getTasksByExids tests ──

TestRunner.test('getTasksByExids: returns tasks matching provided exids', async () => {
  await seedData({
    tasks: [
      { exid: 'TASK1', description: 'First task', lastModified: new Date(), deleted: false },
      { exid: 'TASK2', description: 'Second task', lastModified: new Date(), deleted: false },
      { exid: 'TASK3', description: 'Third task', lastModified: new Date(), deleted: false }
    ]
  });

  const db = await TimesheetDB();
  const result = await db.getTasksByExids(['TASK1', 'TASK3']);

  TestRunner.assertEquals(result.length, 2, 'Should return 2 tasks');
  const exids = result.map(t => t.exid).sort();
  TestRunner.assertEquals(exids[0], 'TASK1', 'Should include TASK1');
  TestRunner.assertEquals(exids[1], 'TASK3', 'Should include TASK3');
});

TestRunner.test('getTasksByExids: excludes deleted tasks', async () => {
  await seedData({
    tasks: [
      { exid: 'TASK1', description: 'Active', lastModified: new Date(), deleted: false },
      { exid: 'TASK2', description: 'Deleted', lastModified: new Date(), deleted: true }
    ]
  });

  const db = await TimesheetDB();
  const result = await db.getTasksByExids(['TASK1', 'TASK2']);

  TestRunner.assertEquals(result.length, 1, 'Should exclude deleted tasks');
  TestRunner.assertEquals(result[0].exid, 'TASK1', 'Should return only the non-deleted task');
});

TestRunner.test('getTasksByExids: returns empty array for empty input', async () => {
  const db = await TimesheetDB();
  const result = await db.getTasksByExids([]);

  TestRunner.assertEquals(result.length, 0, 'Should return empty array for empty exid list');
});
