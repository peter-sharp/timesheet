// Integration tests for the Stats page 12-month trend (tasks completed + estimates met per month)
// E2E (Playwright, pending): open #stats → "12-Month Trend" chart shows 12 month labels,
// a bar per month sized by tasks completed, a dashed monthly-goal line and an estimates-met % line.
import TimesheetDB from '../timesheetDb.js';
import '../stats/stats.js';

async function clearDB() {
    const db = await TimesheetDB();
    for (const task of await db.getAllTasksIncludingDeleted(1000)) await db.permanentlyDeleteTask(task.exid);
    for (const entry of await db.getAllEntries()) await db.permanentlyDeleteEntry(entry.id);
    const deletedEntries = [];
    for await (const e of db.getDeletedEntries()) deletedEntries.push(e);
    for (const e of deletedEntries) await db.permanentlyDeleteEntry(e.id);
}

// A Mon-Fri workday in the month at `monthOffset` (0 = this month)
function monthWorkday(monthOffset, day = 10, hours = 9) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, day, hours, 0, 0, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
}

function hoursAfter(date, hours) {
    return new Date(date.getTime() + hours * 3600 * 1000);
}

const appContext = document.querySelector('app-context');

TestRunner.test('monthlyTrend: has 12 months ending with the current month', async () => {
    await clearDB();
    await appContext.handleLoadStats();

    const trend = appContext.monthlyTrend.value;
    TestRunner.assertEquals(trend.length, 12, 'Should have 12 months');

    const now = new Date();
    const last = trend[11];
    const first = trend[0];
    const oldest = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    TestRunner.assertEquals(last.year, now.getFullYear(), 'Last item is the current year');
    TestRunner.assertEquals(last.month, now.getMonth(), 'Last item is the current month');
    TestRunner.assertEquals(first.year, oldest.getFullYear(), 'First item is 11 months ago (year)');
    TestRunner.assertEquals(first.month, oldest.getMonth(), 'First item is 11 months ago (month)');
    TestRunner.assert(trend.every(m => m.tasksCompleted === 0 && m.estimateRate === null),
        'Empty months have 0 tasks and no estimate rate');
});

TestRunner.test('monthlyTrend: counts completed tasks and estimate rate per month', async () => {
    await clearDB();
    const db = await TimesheetDB();

    const thisMonth = monthWorkday(0, 1);
    const twoAgo    = monthWorkday(-2, 10);
    const tooOld    = monthWorkday(-13, 10);

    const tasks = [
        // This month: 1 met (1h of 2h), 1 over (2h of 0.5h)
        { exid: 'M0A', description: 'met', complete: true, estimate: 2,   lastModified: thisMonth },
        { exid: 'M0B', description: 'over', complete: true, estimate: 0.5, lastModified: thisMonth },
        // Not complete — ignored
        { exid: 'M0C', description: 'open', complete: false, lastModified: thisMonth },
        // Two months ago: 1 met
        { exid: 'M2A', description: 'met', complete: true, estimate: 3, lastModified: twoAgo },
        // Outside the 12-month window — ignored
        { exid: 'OLD', description: 'old', complete: true, lastModified: tooOld }
    ];
    for (const t of tasks) await db.addTask({ ...t, deleted: false });

    const entries = [
        { id: 'e1', task: 'M0A', start: thisMonth, end: hoursAfter(thisMonth, 1) },
        { id: 'e2', task: 'M0B', start: thisMonth, end: hoursAfter(thisMonth, 2) },
        { id: 'e3', task: 'M2A', start: twoAgo,    end: hoursAfter(twoAgo, 1) }
    ];
    for (const e of entries) await db.addEntry({ ...e, lastModified: e.start, deleted: false });

    await appContext.handleLoadStats();
    const trend = appContext.monthlyTrend.value;

    TestRunner.assertEquals(trend[11].tasksCompleted, 2, 'Current month: 2 completed');
    TestRunner.assertEquals(trend[11].estimatesMet, 1, 'Current month: 1 met estimate');
    TestRunner.assertEquals(trend[11].estimateRate, 50, 'Current month: 50% met');
    TestRunner.assertEquals(trend[9].tasksCompleted, 1, 'Two months ago: 1 completed');
    TestRunner.assertEquals(trend[9].estimateRate, 100, 'Two months ago: 100% met');
    TestRunner.assertEquals(trend[10].tasksCompleted, 0, 'Last month: none');
    const total = trend.reduce((sum, m) => sum + m.tasksCompleted, 0);
    TestRunner.assertEquals(total, 3, 'Tasks older than 12 months are excluded');
});

TestRunner.test('monthlyTrend: independent of month navigation offset', async () => {
    await clearDB();
    await appContext.handleLoadStats({ monthOffset: -3 });
    const trend = appContext.monthlyTrend.value;
    TestRunner.assertEquals(trend[11].month, new Date().getMonth(), 'Trend still ends at current month');
});

TestRunner.test('stats page: renders trend chart with 12 bars and an estimate line', async () => {
    await clearDB();
    const db = await TimesheetDB();
    const day = monthWorkday(0, 1);
    await db.addTask({ exid: 'R1', description: 'r', complete: true, estimate: 2, lastModified: day, deleted: false });

    const page = document.createElement('stats-page');
    appContext.appendChild(page);
    await appContext.handleLoadStats();
    await new Promise(r => setTimeout(r, 50));

    const chart = page.querySelector('trend-chart');
    TestRunner.assert(chart, 'trend-chart should be on the stats page');
    const svg = chart.shadowRoot;
    TestRunner.assertEquals(svg.querySelectorAll('.bar').length, 12, 'One bar per month');
    TestRunner.assertEquals(svg.querySelectorAll('.month-label').length, 12, 'One label per month');
    TestRunner.assert(svg.querySelector('.rate-line'), 'Estimate-met % line rendered');
    TestRunner.assert(svg.querySelector('.goal-line'), 'Monthly tasks goal line rendered');

    page.remove();
});
