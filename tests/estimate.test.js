// Tests for task estimates: todo.txt roundtrip, storing on add, status bar comparison
// against all-time task hours, and stats "estimates met" aggregation
import TimesheetDB from '../timesheetDb.js';
import { lineToTask, taskToLine } from '../todoTxtFormat.js';
import { DEFAULT_ESTIMATE, taskEstimate } from '../utils/estimate.js';
import '../current-task.js';

const appContext = document.querySelector('app-context');
const wait = (ms = 100) => new Promise(r => setTimeout(r, ms));

async function clearDb() {
    const db = await TimesheetDB();
    for (const task of await db.getAllTasks()) await db.permanentlyDeleteTask(task.exid);
    const deletedTasks = [];
    for await (const task of db.getDeletedTasks()) deletedTasks.push(task);
    for (const task of deletedTasks) await db.permanentlyDeleteTask(task.exid);
    for (const entry of await db.getAllEntries()) await db.permanentlyDeleteEntry(entry.id);
    return db;
}

// A Mon-Fri date in the previous calendar month, so the whole month is charted
function lastMonthWorkday(day, hours = 9) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, day, hours, 0, 0, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
}

const hoursAfter = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000);

TestRunner.test('estimate: todo.txt roundtrip keeps estimate:0.4', async () => {
    const task = lineToTask('#E1 Write report estimate:0.4');
    TestRunner.assertEquals(task.estimate, '0.4', 'estimate should be parsed');
    TestRunner.assertEquals(task.description, 'Write report', 'estimate should be stripped from description');
    TestRunner.assert(taskToLine(task).includes('estimate:0.4'), 'estimate should be written back');
});

TestRunner.test('estimate: default is implicit and not written to todo.txt', async () => {
    const task = lineToTask('#E2 No estimate');
    TestRunner.assert(!taskToLine(task).includes('estimate:'), 'no estimate add-on should be written');
    TestRunner.assertEquals(taskEstimate(task), DEFAULT_ESTIMATE, 'default estimate should be 0.8');
    TestRunner.assertEquals(DEFAULT_ESTIMATE, 0.8, 'default should be 0.8');
});

TestRunner.test('estimate: addTask stores estimate from raw input', async () => {
    appContext.tasks.value = [];
    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'addTask', raw: '#EA1 Estimate me estimate:0.4' }, bubbles: true
    }));
    await wait();
    const task = appContext.tasks.value.find(t => t.exid === 'EA1');
    TestRunner.assertEquals(task?.estimate, '0.4', 'estimate should be stored on the task');
    TestRunner.assertEquals(task?.description, 'Estimate me', 'description should not contain estimate');
});

TestRunner.test('estimate: More info estimate field is submitted with the task', async () => {
    appContext.tasks.value = [];
    const form = document.querySelector('task-list form[data-new-task]');
    form.elements.taskRaw.value = '#EA2 From form';
    form.elements.estimate.value = '1.5';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait();
    const task = appContext.tasks.value.find(t => t.exid === 'EA2');
    TestRunner.assertEquals(task?.estimate, '1.5', 'estimate from More info should be stored');
    TestRunner.assertEquals(form.elements.estimate.value, '', 'estimate field should be cleared');
});

TestRunner.test('estimate: re-adding existing task updates its estimate', async () => {
    appContext.tasks.value = [{ exid: 'EA3', description: 'Existing', estimate: '0.5' }];
    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'addTask', raw: '#EA3 estimate:2' }, bubbles: true
    }));
    await wait();
    const task = appContext.tasks.value.find(t => t.exid === 'EA3');
    TestRunner.assertEquals(task.estimate, '2', 'estimate should be updated');
    TestRunner.assertEquals(task.description, 'Existing', 'description should be kept');
});

TestRunner.test('estimate: getEntriesByTasks returns only entries of given tasks', async () => {
    const db = await clearDb();
    const start = lastMonthWorkday(3);
    await db.addEntry({ id: 'gebt1', task: 'GA', start, end: hoursAfter(start, 1) });
    await db.addEntry({ id: 'gebt2', task: 'GB', start, end: hoursAfter(start, 1) });
    await db.addEntry({ id: 'gebt3', task: 'GA', start: hoursAfter(start, 2), end: hoursAfter(start, 3) });
    const entries = await db.getEntriesByTasks(['GA']);
    TestRunner.assertEquals(entries.length, 2, 'should return both GA entries');
    TestRunner.assert(entries.every(e => e.task === 'GA'), 'should only return GA entries');
});

TestRunner.test('estimate: status bar shows all-time hours vs estimate and updates live', async () => {
    const db = await clearDb();
    // 1h logged on a previous day (in DB only), 0.5h logged today (in memory)
    const pastStart = lastMonthWorkday(5);
    await db.addEntry({ id: 'sb_past', task: 'SB1', start: pastStart, end: hoursAfter(pastStart, 1) });
    appContext.entries.value = [];
    appContext.tasks.value = [{ exid: 'SB1', description: 'Status bar task', estimate: '2', total: 0.5 }];

    // Parsed (not createElement) so the constructor may append its template, as in index.html
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<current-task></current-task>';
    appContext.appendChild(wrapper);
    const currentTask = wrapper.querySelector('current-task');
    try {
        // Running entry started 15 minutes ago
        appContext.newEntry.value = { task: 'SB1', start: new Date(Date.now() - 15 * 60 * 1000), end: null };
        await wait(150);

        const output = currentTask.querySelector('[name="estimate"]');
        TestRunner.assertEquals(appContext.taskPastTotals.value.SB1, 1, 'past totals should hold previous-day hours');
        TestRunner.assert(output.value.startsWith('1.75h / 2.00h'), `should show all-time vs estimate, got "${output.value}"`);
        TestRunner.assert(output.value.includes('left'), 'should show time left');
        TestRunner.assert(!output.hasAttribute('data-over'), 'should not be marked over');

        // Without an explicit estimate the 0.8 default applies → over
        appContext.tasks.value = [{ exid: 'SB1', description: 'Status bar task', total: 0.5 }];
        await wait(50);
        currentTask.update();
        TestRunner.assert(output.value.includes('/ 0.80h'), `should use default estimate, got "${output.value}"`);
        TestRunner.assert(output.value.includes('over'), 'should show over estimate');
        TestRunner.assert(output.hasAttribute('data-over'), 'should be marked over');
    } finally {
        wrapper.remove();
        appContext.newEntry.value = {};
        appContext.tasks.value = [];
    }
});

TestRunner.test('estimate: loadStats counts completed tasks meeting estimates', async () => {
    const db = await clearDb();
    const doneDay = lastMonthWorkday(10, 17);
    const workStart = lastMonthWorkday(10, 9);
    const earlier = lastMonthWorkday(10, 9);
    earlier.setMonth(earlier.getMonth() - 1); // work from an earlier month still counts

    await db.addTask({ exid: 'ST_UNDER', description: 'Under', complete: true, estimate: '1', lastModified: doneDay });
    await db.addTask({ exid: 'ST_OVER', description: 'Over', complete: true, lastModified: doneDay });
    // ST_UNDER: 0.5h (estimate 1) → met
    await db.addEntry({ id: 'st_e1', task: 'ST_UNDER', start: workStart, end: hoursAfter(workStart, 0.5) });
    // ST_OVER: 0.5h this month + 0.5h earlier month = 1h > default 0.8 → not met
    await db.addEntry({ id: 'st_e2', task: 'ST_OVER', start: hoursAfter(workStart, 1), end: hoursAfter(workStart, 1.5) });
    await db.addEntry({ id: 'st_e3', task: 'ST_OVER', start: earlier, end: hoursAfter(earlier, 0.5) });

    await appContext.handleLoadStats({ monthOffset: -1 });
    const monthly = appContext.monthlyStats.value;
    TestRunner.assertEquals(monthly.tasksCompleted, 2, 'two completed tasks');
    TestRunner.assertEquals(monthly.estimatesMet, 1, 'one task met its estimate');
    const day = monthly.dailyEstimateRate.find(d => d.x === doneDay.getDate());
    TestRunner.assertEquals(day?.y, 50, 'daily rate should be 50%');
    TestRunner.assertEquals(monthly.dailyEstimateRate.length, 1, 'days without completions are skipped');
    await clearDb();
});
