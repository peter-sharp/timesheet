// prev-tasks history tests
import TimesheetDB from '../timesheetDb.js';

// Helper to clear and seed IndexedDB
async function seedTasks(tasks) {
  const db = await TimesheetDB();
  // Clear existing tasks first
  const allTasks = await db.getAllTasks();
  for (const task of allTasks) {
    await db.permanentlyDeleteTask(task.exid);
  }
  // Add test tasks
  for (const task of tasks) {
    await db.addTask(task);
  }
}

// Helper to wait for allTasks signal to update
async function waitForAllTasksUpdate() {
  // Wait for next tick to allow signals to propagate
  await new Promise(r => setTimeout(r, 100));
}

TestRunner.test('getRecentTasks excludes tasks modified today', async () => {
  const db = await TimesheetDB();

  // Create dates
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Seed with tasks from different days
  await seedTasks([
    {
      exid: 'TODAY1',
      description: 'Task from today',
      lastModified: now,
      deleted: false
    },
    {
      exid: 'YEST1',
      description: 'Task from yesterday',
      lastModified: yesterday,
      deleted: false
    }
  ]);

  const recentTasks = await db.getRecentTasks(500);
  const exids = recentTasks.map(t => t.exid);

  // Should include yesterday's task
  TestRunner.assert(
    exids.includes('YEST1'),
    'Should include task from yesterday'
  );

  // Should NOT include today's task
  TestRunner.assert(
    !exids.includes('TODAY1'),
    'Should NOT include task from today'
  );
});

TestRunner.test('getRecentTasks respects limit parameter', async () => {
  const db = await TimesheetDB();

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Create more tasks than the limit
  const tasks = Array.from({ length: 10 }, (_, i) => ({
    exid: `HIST${i}`,
    description: `Historical task ${i}`,
    lastModified: new Date(twoDaysAgo.getTime() - i * 1000),
    deleted: false
  }));

  await seedTasks(tasks);

  const recentTasks = await db.getRecentTasks(5);

  TestRunner.assertEquals(
    recentTasks.length,
    5,
    'Should return exactly 5 tasks when limit is 5'
  );
});

TestRunner.test('getRecentTasks excludes deleted tasks', async () => {
  const db = await TimesheetDB();

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  await seedTasks([
    {
      exid: 'ACTIVE1',
      description: 'Active task',
      lastModified: twoDaysAgo,
      deleted: false
    },
    {
      exid: 'DELETED1',
      description: 'Deleted task',
      lastModified: twoDaysAgo,
      deleted: true
    }
  ]);

  const recentTasks = await db.getRecentTasks(500);
  const exids = recentTasks.map(t => t.exid);

  TestRunner.assert(
    exids.includes('ACTIVE1'),
    'Should include active task'
  );

  TestRunner.assert(
    !exids.includes('DELETED1'),
    'Should NOT include deleted task'
  );
});

TestRunner.test('getRecentTasks returns tasks in reverse chronological order', async () => {
  const db = await TimesheetDB();

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await seedTasks([
    {
      exid: 'OLD1',
      description: 'Oldest task',
      lastModified: threeDaysAgo,
      deleted: false
    },
    {
      exid: 'MID1',
      description: 'Middle task',
      lastModified: twoDaysAgo,
      deleted: false
    },
    {
      exid: 'RECENT1',
      description: 'Most recent task',
      lastModified: yesterday,
      deleted: false
    }
  ]);

  const recentTasks = await db.getRecentTasks(500);

  // Most recent should be first
  TestRunner.assertEquals(
    recentTasks[0].exid,
    'RECENT1',
    'Most recent task should be first'
  );

  TestRunner.assertEquals(
    recentTasks[1].exid,
    'MID1',
    'Middle task should be second'
  );

  TestRunner.assertEquals(
    recentTasks[2].exid,
    'OLD1',
    'Oldest task should be last'
  );
});

TestRunner.test('task-list datalist populates with historical tasks only', async () => {
  const db = await TimesheetDB();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await seedTasks([
    {
      exid: 'HIST1',
      description: 'Historical task',
      project: 'oldproject',
      client: 'oldclient',
      lastModified: yesterday,
      deleted: false
    }
  ]);

  // Trigger allTasks reload
  const appContext = document.querySelector('app-context');
  if (appContext) {
    const db = await TimesheetDB();
    appContext.allTasks.value = await db.getRecentTasks(500);
  }

  await waitForAllTasksUpdate();

  // Check the datalist
  const datalist = document.querySelector('#prev-tasks');
  const options = Array.from(datalist?.querySelectorAll('option') || []);
  const values = options.map(opt => opt.value);

  TestRunner.assert(
    values.some(v => v.includes('#HIST1')),
    'Datalist should include historical task'
  );

  TestRunner.assert(
    values.some(v => v.includes('Historical task')),
    'Datalist should include task description'
  );
});
