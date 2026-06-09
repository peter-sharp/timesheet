// searchArchivedTasks tests
import TimesheetDB from '../timesheetDb.js';

async function seedData({ tasks = [] }) {
  const db = await TimesheetDB();
  // getAllTasksIncludingDeleted returns both active and soft-deleted tasks
  const allTasks = await db.getAllTasksIncludingDeleted(1000);
  for (const task of allTasks) {
    await db.permanentlyDeleteTask(task.exid);
  }
  for (const task of tasks) {
    await db.addTask(task);
  }
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d;
}

// ── searchArchivedTasks tests ──

TestRunner.test('searchArchivedTasks: returns tasks matching description', async () => {
  await seedData({
    tasks: [
      { exid: 'T1', description: 'Homepage redesign', lastModified: daysAgo(2), deleted: false },
      { exid: 'T2', description: 'Footer update', lastModified: daysAgo(2), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('homepage');

  TestRunner.assertEquals(results.length, 1, 'Should match on description');
  TestRunner.assertEquals(results[0].exid, 'T1', 'Should return the matching task');
});

TestRunner.test('searchArchivedTasks: returns tasks matching exid', async () => {
  await seedData({
    tasks: [
      { exid: 'PROJ-123', description: 'Build API', lastModified: daysAgo(3), deleted: false },
      { exid: 'PROJ-456', description: 'Write tests', lastModified: daysAgo(3), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('PROJ-123');

  TestRunner.assertEquals(results.length, 1, 'Should match on exid');
  TestRunner.assertEquals(results[0].exid, 'PROJ-123', 'Should return correct task');
});

TestRunner.test('searchArchivedTasks: returns tasks matching project', async () => {
  await seedData({
    tasks: [
      { exid: 'T1', description: 'Task one', project: 'website', lastModified: daysAgo(2), deleted: false },
      { exid: 'T2', description: 'Task two', project: 'backend', lastModified: daysAgo(2), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('website');

  TestRunner.assertEquals(results.length, 1, 'Should match on project');
  TestRunner.assertEquals(results[0].exid, 'T1', 'Should return the matching task');
});

TestRunner.test('searchArchivedTasks: returns tasks matching client', async () => {
  await seedData({
    tasks: [
      { exid: 'T1', description: 'Task one', client: 'acme', lastModified: daysAgo(2), deleted: false },
      { exid: 'T2', description: 'Task two', client: 'globex', lastModified: daysAgo(2), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('acme');

  TestRunner.assertEquals(results.length, 1, 'Should match on client');
  TestRunner.assertEquals(results[0].exid, 'T1', 'Should return the matching task');
});

TestRunner.test('searchArchivedTasks: matching is case-insensitive', async () => {
  await seedData({
    tasks: [
      { exid: 'T1', description: 'Homepage Redesign', lastModified: daysAgo(2), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('HOMEPAGE');

  TestRunner.assertEquals(results.length, 1, 'Should match regardless of case');
});

TestRunner.test('searchArchivedTasks: excludes tasks modified today', async () => {
  const today = new Date();
  await seedData({
    tasks: [
      { exid: 'TODAY', description: 'Today task', lastModified: today, deleted: false },
      { exid: 'OLD', description: 'Old task', lastModified: daysAgo(1), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('task');

  TestRunner.assertEquals(results.length, 1, "Should exclude today's tasks");
  TestRunner.assertEquals(results[0].exid, 'OLD', 'Should return only the old task');
});

TestRunner.test('searchArchivedTasks: excludes deleted tasks', async () => {
  await seedData({
    tasks: [
      { exid: 'T1', description: 'Active task', lastModified: daysAgo(2), deleted: false },
      { exid: 'T2', description: 'Deleted task', lastModified: daysAgo(2), deleted: true },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('task');

  TestRunner.assertEquals(results.length, 1, 'Should exclude deleted tasks');
  TestRunner.assertEquals(results[0].exid, 'T1', 'Should return only the non-deleted task');
});

TestRunner.test('searchArchivedTasks: returns empty array when no matches', async () => {
  await seedData({
    tasks: [
      { exid: 'T1', description: 'Homepage redesign', lastModified: daysAgo(2), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('unrelated');

  TestRunner.assertEquals(results.length, 0, 'Should return empty array when nothing matches');
});

TestRunner.test('searchArchivedTasks: respects limit parameter', async () => {
  await seedData({
    tasks: [
      { exid: 'T1', description: 'Feature one', lastModified: daysAgo(2), deleted: false },
      { exid: 'T2', description: 'Feature two', lastModified: daysAgo(2), deleted: false },
      { exid: 'T3', description: 'Feature three', lastModified: daysAgo(2), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('feature', 2);

  TestRunner.assertEquals(results.length, 2, 'Should respect the limit');
});

TestRunner.test('searchArchivedTasks: returns multiple matches across different fields', async () => {
  await seedData({
    tasks: [
      { exid: 'alpha', description: 'Alpha task', lastModified: daysAgo(2), deleted: false },
      { exid: 'T2', description: 'Beta task', project: 'alpha', lastModified: daysAgo(2), deleted: false },
      { exid: 'T3', description: 'Gamma task', client: 'alphacorp', lastModified: daysAgo(2), deleted: false },
    ]
  });

  const db = await TimesheetDB();
  const results = await db.searchArchivedTasks('alpha');

  TestRunner.assertEquals(results.length, 3, 'Should match across exid, project, and client fields');
});
