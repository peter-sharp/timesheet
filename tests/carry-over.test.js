// Carry-over: unfinished tasks worked on the previous workday show up in today's list
import TimesheetDB from '../timesheetDb.js';

const appContext = document.querySelector('app-context');

async function seedData({ tasks = [], entries = [] }) {
  const db = await TimesheetDB();
  for (const task of await db.getAllTasks()) await db.permanentlyDeleteTask(task.exid);
  for (const entry of await db.getAllEntries()) await db.permanentlyDeleteEntry(entry.id);
  for (const task of tasks) await db.addTask(task);
  for (const entry of entries) await db.addEntry(entry);
}

function daysAgoAt(days, hours) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hours, 0, 0, 0);
  return d;
}

const task = (exid, days, extra = {}) => ({ exid, description: exid, lastModified: daysAgoAt(days, 9), deleted: false, ...extra });
const entry = (id, exid, days) => ({ id, task: exid, start: daysAgoAt(days, 10), end: daysAgoAt(days, 11), lastModified: daysAgoAt(days, 11), deleted: false });
const listed = exid => appContext.tasks.value.some(t => t.exid === exid);

TestRunner.test('carry-over: unfinished task worked yesterday appears today', async () => {
  await seedData({ tasks: [task('CO1', 1)], entries: [entry('co-e1', 'CO1', 1)] });
  await appContext._reloadTodayData();

  TestRunner.assert(listed('CO1'), 'yesterday\'s unfinished task should be in today\'s list');
  const [stored] = await (await TimesheetDB()).getTasksByExids(['CO1']);
  TestRunner.assertEquals(new Date(stored.lastModified).toDateString(), new Date().toDateString(), 'lastModified touched to today');
});

TestRunner.test('carry-over: completed and archived tasks are not carried', async () => {
  await seedData({
    tasks: [task('CO2', 1, { complete: true, status: 'complete' }), task('CO3', 1, { archived: true })],
    entries: [entry('co-e2', 'CO2', 1), entry('co-e3', 'CO3', 1)]
  });
  await appContext._reloadTodayData();

  TestRunner.assert(!listed('CO2'), 'completed task should not be carried');
  TestRunner.assert(!listed('CO3'), 'archived task should not be carried');
});

TestRunner.test('carry-over: skips empty days (e.g. weekend) back to last worked day', async () => {
  await seedData({
    tasks: [task('CO4', 3), task('CO5', 5)],
    entries: [entry('co-e4', 'CO4', 3), entry('co-e5', 'CO5', 5)]
  });
  await appContext._reloadTodayData();

  TestRunner.assert(listed('CO4'), 'task from last worked day should be carried');
  TestRunner.assert(!listed('CO5'), 'task from an earlier day should not be carried');
});

TestRunner.test('carry-over: task already listed today is not duplicated', async () => {
  await seedData({ tasks: [task('CO6', 0)], entries: [entry('co-e6', 'CO6', 1)] });
  await appContext._reloadTodayData();
  await appContext._reloadTodayData();

  TestRunner.assertEquals(appContext.tasks.value.filter(t => t.exid === 'CO6').length, 1, 'task listed once');
  await seedData({});
  await appContext._reloadTodayData();
});
