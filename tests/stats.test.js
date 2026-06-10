// Tests for stats-related DB queries and the handleLoadStats aggregation logic
import TimesheetDB from '../timesheetDb.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedData({ tasks = [], entries = [] }) {
    const db = await TimesheetDB();

    const allTasks = await db.getAllTasks();
    for (const task of allTasks) await db.permanentlyDeleteTask(task.exid);

    // Also clear soft-deleted tasks so exid constraint doesn't fire on re-add
    const deletedTasks = [];
    for await (const task of db.getDeletedTasks()) deletedTasks.push(task);
    for (const task of deletedTasks) await db.permanentlyDeleteTask(task.exid);

    const allEntries = await db.getAllEntries();
    for (const entry of allEntries) await db.permanentlyDeleteEntry(entry.id);

    // Also clear soft-deleted entries
    const deletedEntries = [];
    for await (const e of db.getDeletedEntries()) deletedEntries.push(e);
    for (const e of deletedEntries) await db.permanentlyDeleteEntry(e.id);

    for (const task of tasks) await db.addTask(task);
    for (const entry of entries) await db.addEntry(entry);
}

function daysAgo(days, hours = 9, minutes = 0) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hours, minutes, 0, 0);
    return d;
}

function thisMonthDay(day, hours = 9, minutes = 0) {
    const d = new Date();
    d.setDate(day);
    d.setHours(hours, minutes, 0, 0);
    return d;
}

// ── getEntriesByDateRange ─────────────────────────────────────────────────────

TestRunner.test('getEntriesByDateRange: returns entries within range', async () => {
    const start = daysAgo(5, 9, 0);
    const end   = daysAgo(5, 17, 0);
    const outOfRange = daysAgo(10, 9, 0);

    await seedData({
        entries: [
            { id: 'in1',  task: 'T1', start, end, lastModified: start, deleted: false },
            { id: 'out1', task: 'T1', start: outOfRange, end: daysAgo(10, 17, 0),
              lastModified: outOfRange, deleted: false }
        ]
    });

    const db = await TimesheetDB();
    const rangeStart = new Date(start); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date(start); rangeEnd.setHours(23, 59, 59, 999);
    const result = await db.getEntriesByDateRange(rangeStart, rangeEnd);

    TestRunner.assertEquals(result.length, 1, 'Should return only the in-range entry');
    TestRunner.assertEquals(result[0].id, 'in1', 'Should return the correct entry');
});

TestRunner.test('getEntriesByDateRange: returns all entries across multiple days', async () => {
    await seedData({
        entries: [
            { id: 'e1', task: 'T1', start: daysAgo(5, 9, 0),  end: daysAgo(5, 12, 0),
              lastModified: daysAgo(5, 9, 0), deleted: false },
            { id: 'e2', task: 'T1', start: daysAgo(4, 9, 0),  end: daysAgo(4, 17, 0),
              lastModified: daysAgo(4, 9, 0), deleted: false },
            { id: 'e3', task: 'T1', start: daysAgo(3, 9, 0),  end: daysAgo(3, 17, 0),
              lastModified: daysAgo(3, 9, 0), deleted: false },
            { id: 'e4', task: 'T1', start: daysAgo(10, 9, 0), end: daysAgo(10, 17, 0),
              lastModified: daysAgo(10, 9, 0), deleted: false }
        ]
    });

    const db = await TimesheetDB();
    const rangeStart = daysAgo(5, 0, 0); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = daysAgo(3, 0, 0); rangeEnd.setHours(23, 59, 59, 999);
    const result = await db.getEntriesByDateRange(rangeStart, rangeEnd);

    TestRunner.assertEquals(result.length, 3, 'Should return all 3 entries within the range');
    const ids = result.map(e => e.id).sort();
    TestRunner.assertEquals(ids.join(','), 'e1,e2,e3', 'Should return the correct entries');
});

TestRunner.test('getEntriesByDateRange: excludes soft-deleted entries', async () => {
    const start = daysAgo(3, 9, 0);
    const end   = daysAgo(3, 17, 0);

    await seedData({
        entries: [
            { id: 'del1',    task: 'T1', start, end, lastModified: start },
            { id: 'active1', task: 'T1', start: daysAgo(3, 10, 0), end: daysAgo(3, 11, 0),
              lastModified: start }
        ]
    });

    const db = await TimesheetDB();
    await db.deleteEntry('del1');

    const rangeStart = new Date(start); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date(start); rangeEnd.setHours(23, 59, 59, 999);
    const result = await db.getEntriesByDateRange(rangeStart, rangeEnd);

    TestRunner.assertEquals(result.length, 1, 'Should exclude soft-deleted entries');
    TestRunner.assertEquals(result[0].id, 'active1', 'Should return only the non-deleted entry');
});

TestRunner.test('getEntriesByDateRange: returns empty array when no entries in range', async () => {
    await seedData({
        entries: [
            { id: 'e1', task: 'T1', start: daysAgo(20, 9, 0), end: daysAgo(20, 17, 0),
              lastModified: daysAgo(20, 9, 0), deleted: false }
        ]
    });

    const db = await TimesheetDB();
    const rangeStart = daysAgo(5, 0, 0); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = daysAgo(3, 0, 0); rangeEnd.setHours(23, 59, 59, 999);
    const result = await db.getEntriesByDateRange(rangeStart, rangeEnd);

    TestRunner.assertEquals(result.length, 0, 'Should return empty array for range with no entries');
});

// ── getTasksModifiedInRange ───────────────────────────────────────────────────

TestRunner.test('getTasksModifiedInRange: returns tasks with lastModified in range', async () => {
    const inRange    = daysAgo(3);
    const outOfRange = daysAgo(10);

    await seedData({
        tasks: [
            { exid: 'T1', description: 'In range',     lastModified: inRange,    deleted: false },
            { exid: 'T2', description: 'Out of range', lastModified: outOfRange, deleted: false }
        ]
    });

    const db = await TimesheetDB();
    const rangeStart = daysAgo(5, 0, 0); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date();       rangeEnd.setHours(23, 59, 59, 999);
    const result = await db.getTasksModifiedInRange(rangeStart, rangeEnd);

    TestRunner.assertEquals(result.length, 1, 'Should return only the in-range task');
    TestRunner.assertEquals(result[0].exid, 'T1', 'Should return the correct task');
});

TestRunner.test('getTasksModifiedInRange: excludes deleted tasks', async () => {
    const modified = daysAgo(2);

    await seedData({
        tasks: [
            { exid: 'T1', description: 'Active',  lastModified: modified, deleted: false },
            { exid: 'T2', description: 'Deleted', lastModified: modified, deleted: true }
        ]
    });

    const db = await TimesheetDB();
    const rangeStart = daysAgo(5, 0, 0); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date();
    const result = await db.getTasksModifiedInRange(rangeStart, rangeEnd);

    TestRunner.assertEquals(result.length, 1, 'Should exclude deleted tasks');
    TestRunner.assertEquals(result[0].exid, 'T1', 'Should return only the non-deleted task');
});

TestRunner.test('getTasksModifiedInRange: returns empty array when no tasks in range', async () => {
    await seedData({
        tasks: [
            { exid: 'T1', description: 'Old task', lastModified: daysAgo(30), deleted: false }
        ]
    });

    const db = await TimesheetDB();
    const rangeStart = daysAgo(7, 0, 0); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = new Date();
    const result = await db.getTasksModifiedInRange(rangeStart, rangeEnd);

    TestRunner.assertEquals(result.length, 0, 'Should return empty for range with no matching tasks');
});

TestRunner.test('getTasksModifiedInRange: returns multiple tasks across range', async () => {
    await seedData({
        tasks: [
            { exid: 'T1', description: 'Day 1', lastModified: daysAgo(5), deleted: false },
            { exid: 'T2', description: 'Day 3', lastModified: daysAgo(3), deleted: false },
            { exid: 'T3', description: 'Day 6', lastModified: daysAgo(6), deleted: false }
        ]
    });

    const db = await TimesheetDB();
    const rangeStart = daysAgo(5, 0, 0); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd   = daysAgo(3, 0, 0); rangeEnd.setHours(23, 59, 59, 999);
    const result = await db.getTasksModifiedInRange(rangeStart, rangeEnd);

    TestRunner.assertEquals(result.length, 2, 'Should return T1 and T2 within the 5-to-3-day range');
    const exids = result.map(t => t.exid).sort();
    TestRunner.assertEquals(exids.join(','), 'T1,T2', 'Should include the correct tasks');
});

// ── handleLoadStats aggregation logic ────────────────────────────────────────
// Test the app-context handleLoadStats by seeding DB data, triggering the
// event, and asserting the resulting signal values.

TestRunner.test('handleLoadStats: computes weekly and monthly hours from entries', async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // 2 h entry today, 3 h entry earlier this month (if month > 3 days old), nothing last month
    const todayStart = new Date(now); todayStart.setHours(9, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(11, 0, 0, 0); // 2 h

    // Pick a day safely inside this month but before today
    const dayInMonth = now.getDate() > 3 ? 2 : null;
    const entries = [
        { id: 'st_e1', task: 'T1', start: todayStart, end: todayEnd,
          lastModified: now, deleted: false }
    ];
    if (dayInMonth) {
        const pastStart = thisMonthDay(dayInMonth, 10, 0);
        const pastEnd   = thisMonthDay(dayInMonth, 13, 0); // 3 h
        entries.push({ id: 'st_e2', task: 'T1', start: pastStart, end: pastEnd,
                       lastModified: pastStart, deleted: false });
    }

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task 1', lastModified: now, deleted: false }],
        entries
    });

    const appContext = document.querySelector('app-context');
    await appContext.handleLoadStats();

    const weekly  = appContext.weeklyStats.value;
    const monthly = appContext.monthlyStats.value;

    TestRunner.assert(weekly  !== null, 'weeklyStats should be populated');
    TestRunner.assert(monthly !== null, 'monthlyStats should be populated');

    const expectedMonthly = dayInMonth ? 5 : 2; // 2 + 3 or just 2
    TestRunner.assertEquals(monthly.hours, expectedMonthly,
        `Monthly hours should be ${expectedMonthly}`);

    // Today is always in this week, so weekly hours should include the 2 h entry
    TestRunner.assert(weekly.hours >= 2,
        'Weekly hours should include the 2h entry from today');
});

TestRunner.test('handleLoadStats: counts only completed tasks this month', async () => {
    const now = new Date();
    const completedThisMonth = new Date(now); completedThisMonth.setHours(8, 0, 0, 0);
    const completedLastMonth  = new Date(now);
    completedLastMonth.setMonth(now.getMonth() - 1);

    await seedData({
        tasks: [
            { exid: 'DONE1', description: 'Done this month', complete: true,
              lastModified: completedThisMonth, deleted: false },
            { exid: 'DONE2', description: 'Done last month', complete: true,
              lastModified: completedLastMonth, deleted: false },
            { exid: 'OPEN1', description: 'Not complete', complete: false,
              lastModified: now, deleted: false }
        ],
        entries: []
    });

    const appContext = document.querySelector('app-context');
    await appContext.handleLoadStats();

    const monthly = appContext.monthlyStats.value;
    TestRunner.assertEquals(monthly.tasksCompleted, 1,
        'Monthly tasks should count only completed tasks with lastModified this month');
});

TestRunner.test('handleLoadStats: builds dailyHours array up to today', async () => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(9, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(11, 30, 0, 0); // 2.5 h

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [
            { id: 'dh_e1', task: 'T1', start: todayStart, end: todayEnd,
              lastModified: now, deleted: false }
        ]
    });

    const appContext = document.querySelector('app-context');
    await appContext.handleLoadStats();

    const monthly = appContext.monthlyStats.value;
    TestRunner.assert(Array.isArray(monthly.dailyHours), 'dailyHours should be an array');

    // With workday filtering (default Mon-Fri), length = workdays elapsed this month up to today
    const defaultWorkdays = [1, 2, 3, 4, 5];
    let expectedDays = 0;
    for (let d = 1; d <= now.getDate(); d++) {
        if (defaultWorkdays.includes(new Date(now.getFullYear(), now.getMonth(), d).getDay())) {
            expectedDays++;
        }
    }
    TestRunner.assertEquals(monthly.dailyHours.length, expectedDays,
        'dailyHours should have one entry per workday up to today');

    // If today is a workday, check the hours entry is present
    if (defaultWorkdays.includes(now.getDay())) {
        const todayEntry = monthly.dailyHours.find(d => d.x === now.getDate());
        TestRunner.assert(todayEntry !== undefined, 'Should have an entry for today (workday)');
        TestRunner.assertEquals(todayEntry.y, 2.5, 'Today should show 2.5 hours');
    }
});

TestRunner.test('handleLoadStats: weekly hours are subset of monthly hours', async () => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(9, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(10, 0, 0, 0); // 1 h

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [
            { id: 'wk_e1', task: 'T1', start: todayStart, end: todayEnd,
              lastModified: now, deleted: false }
        ]
    });

    const appContext = document.querySelector('app-context');
    await appContext.handleLoadStats();

    const weekly  = appContext.weeklyStats.value;
    const monthly = appContext.monthlyStats.value;

    TestRunner.assert(weekly.hours <= monthly.hours,
        'Weekly hours should never exceed monthly hours');
    TestRunner.assert(weekly.hours >= 0, 'Weekly hours should be non-negative');
    TestRunner.assert(monthly.hours >= 0, 'Monthly hours should be non-negative');
});
