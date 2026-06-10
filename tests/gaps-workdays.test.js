// Tests for gap calculation and workday filtering in handleLoadStats
import TimesheetDB from '../timesheetDb.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedData({ tasks = [], entries = [] }) {
    const db = await TimesheetDB();

    const allTasks = await db.getAllTasks();
    for (const task of allTasks) await db.permanentlyDeleteTask(task.exid);

    const deletedTasks = [];
    for await (const task of db.getDeletedTasks()) deletedTasks.push(task);
    for (const task of deletedTasks) await db.permanentlyDeleteTask(task.exid);

    const allEntries = await db.getAllEntries();
    for (const entry of allEntries) await db.permanentlyDeleteEntry(entry.id);

    const deletedEntries = [];
    for await (const e of db.getDeletedEntries()) deletedEntries.push(e);
    for (const e of deletedEntries) await db.permanentlyDeleteEntry(e.id);

    for (const task of tasks) await db.addTask(task);
    for (const entry of entries) await db.addEntry(entry);
}

function dayEntry(day, startHour, endHour, id) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), day, startHour, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth(), day, endHour,   0, 0, 0);
    return { id, task: 'T1', start, end, lastModified: start, deleted: false };
}

function setWorkdays(appContext, workdays) {
    appContext.settings.value = { ...appContext.settings.value, workdays };
}

function restoreDefaultWorkdays(appContext) {
    appContext.settings.value = { ...appContext.settings.value, workdays: [1, 2, 3, 4, 5] };
}

// ── Gap calculation ───────────────────────────────────────────────────────────

TestRunner.test('handleLoadStats: dailyGaps array is included in monthlyStats', async () => {
    const now = new Date();
    const start = new Date(now); start.setHours(9, 0, 0, 0);
    const end   = new Date(now); end.setHours(10, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [{ id: 'gw_a1', task: 'T1', start, end, lastModified: now, deleted: false }]
    });

    const appContext = document.querySelector('app-context');
    // Use all days so today is always included regardless of day-of-week
    setWorkdays(appContext, [0, 1, 2, 3, 4, 5, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    TestRunner.assert(Array.isArray(monthly.dailyGaps), 'dailyGaps should be an array');
    TestRunner.assert(monthly.gaps !== undefined, 'monthly.gaps should be defined');
});

TestRunner.test('handleLoadStats: dailyGaps is 0 when day has only one entry', async () => {
    const now = new Date();
    const start = new Date(now); start.setHours(9, 0, 0, 0);
    const end   = new Date(now); end.setHours(11, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [{ id: 'gw_b1', task: 'T1', start, end, lastModified: now, deleted: false }]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [0, 1, 2, 3, 4, 5, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    const todayEntry = monthly.dailyGaps.find(d => d.x === now.getDate());
    TestRunner.assert(todayEntry !== undefined, 'Should have a gap entry for today');
    TestRunner.assertEquals(todayEntry.y, 0, 'Gap should be 0 with only one entry');
});

TestRunner.test('handleLoadStats: dailyGaps equals gap between two consecutive entries', async () => {
    const now = new Date();
    // Entry 1: 9:00-11:00, Entry 2: 14:00-17:00 → gap = 3h
    const s1 = new Date(now); s1.setHours(9, 0, 0, 0);
    const e1 = new Date(now); e1.setHours(11, 0, 0, 0);
    const s2 = new Date(now); s2.setHours(14, 0, 0, 0);
    const e2 = new Date(now); e2.setHours(17, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [
            { id: 'gw_c1', task: 'T1', start: s1, end: e1, lastModified: s1, deleted: false },
            { id: 'gw_c2', task: 'T1', start: s2, end: e2, lastModified: s2, deleted: false }
        ]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [0, 1, 2, 3, 4, 5, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    const todayEntry = monthly.dailyGaps.find(d => d.x === now.getDate());
    TestRunner.assert(todayEntry !== undefined, 'Should have a gap entry for today');
    TestRunner.assertEquals(todayEntry.y, 3, 'Gap should be 3h between 11:00 and 14:00');
});

TestRunner.test('handleLoadStats: dailyGaps sums multiple gaps on same day', async () => {
    const now = new Date();
    // Entries: 9-10, 11-12, 14-15 → gaps = 1h + 2h = 3h
    const s1 = new Date(now); s1.setHours(9,  0, 0, 0);
    const e1 = new Date(now); e1.setHours(10, 0, 0, 0);
    const s2 = new Date(now); s2.setHours(11, 0, 0, 0);
    const e2 = new Date(now); e2.setHours(12, 0, 0, 0);
    const s3 = new Date(now); s3.setHours(14, 0, 0, 0);
    const e3 = new Date(now); e3.setHours(15, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [
            { id: 'gw_d1', task: 'T1', start: s1, end: e1, lastModified: s1, deleted: false },
            { id: 'gw_d2', task: 'T1', start: s2, end: e2, lastModified: s2, deleted: false },
            { id: 'gw_d3', task: 'T1', start: s3, end: e3, lastModified: s3, deleted: false }
        ]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [0, 1, 2, 3, 4, 5, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    const todayEntry = monthly.dailyGaps.find(d => d.x === now.getDate());
    TestRunner.assert(todayEntry !== undefined, 'Should have a gap entry for today');
    TestRunner.assertEquals(todayEntry.y, 3, 'Gap should sum to 3h (1h + 2h)');
});

TestRunner.test('handleLoadStats: dailyGaps treats overlapping entries as 0 gap', async () => {
    const now = new Date();
    // Entries: 9:00-11:00, 10:00-12:00 → end of first is AFTER start of second → 0 gap
    const s1 = new Date(now); s1.setHours(9,  0, 0, 0);
    const e1 = new Date(now); e1.setHours(11, 0, 0, 0);
    const s2 = new Date(now); s2.setHours(10, 0, 0, 0);
    const e2 = new Date(now); e2.setHours(12, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [
            { id: 'gw_e1', task: 'T1', start: s1, end: e1, lastModified: s1, deleted: false },
            { id: 'gw_e2', task: 'T1', start: s2, end: e2, lastModified: s2, deleted: false }
        ]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [0, 1, 2, 3, 4, 5, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    const todayEntry = monthly.dailyGaps.find(d => d.x === now.getDate());
    TestRunner.assert(todayEntry !== undefined, 'Should have a gap entry for today');
    TestRunner.assertEquals(todayEntry.y, 0, 'Overlapping entries should produce 0 gap');
});

TestRunner.test('handleLoadStats: monthlyStats.gaps equals sum of dailyGaps y values', async () => {
    const now = new Date();
    // Two entries today with a 2h gap
    const s1 = new Date(now); s1.setHours(9,  0, 0, 0);
    const e1 = new Date(now); e1.setHours(10, 0, 0, 0);
    const s2 = new Date(now); s2.setHours(12, 0, 0, 0);
    const e2 = new Date(now); e2.setHours(14, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [
            { id: 'gw_f1', task: 'T1', start: s1, end: e1, lastModified: s1, deleted: false },
            { id: 'gw_f2', task: 'T1', start: s2, end: e2, lastModified: s2, deleted: false }
        ]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [0, 1, 2, 3, 4, 5, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    const sumOfDailyGaps = Math.round(
        monthly.dailyGaps.reduce((sum, d) => sum + d.y, 0) * 10
    ) / 10;
    TestRunner.assertEquals(monthly.gaps, sumOfDailyGaps,
        'monthly.gaps should equal the sum of all dailyGaps y values');
});

TestRunner.test('handleLoadStats: dailyGaps has no negative values', async () => {
    const now = new Date();
    // Mix of normal and overlapping entries
    const s1 = new Date(now); s1.setHours(9,  0, 0, 0);
    const e1 = new Date(now); e1.setHours(11, 0, 0, 0);
    const s2 = new Date(now); s2.setHours(10, 0, 0, 0); // overlaps
    const e2 = new Date(now); e2.setHours(13, 0, 0, 0);
    const s3 = new Date(now); s3.setHours(15, 0, 0, 0);
    const e3 = new Date(now); e3.setHours(16, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [
            { id: 'gw_g1', task: 'T1', start: s1, end: e1, lastModified: s1, deleted: false },
            { id: 'gw_g2', task: 'T1', start: s2, end: e2, lastModified: s2, deleted: false },
            { id: 'gw_g3', task: 'T1', start: s3, end: e3, lastModified: s3, deleted: false }
        ]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [0, 1, 2, 3, 4, 5, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    for (const d of monthly.dailyGaps) {
        TestRunner.assert(d.y >= 0, `dailyGaps entry for day ${d.x} should not be negative`);
    }
    TestRunner.assert(monthly.gaps >= 0, 'monthly.gaps should not be negative');
});

// ── Workday filtering ─────────────────────────────────────────────────────────

TestRunner.test('handleLoadStats: workdays=[] produces empty chart arrays', async () => {
    const now = new Date();
    const start = new Date(now); start.setHours(9, 0, 0, 0);
    const end   = new Date(now); end.setHours(11, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [{ id: 'gw_h1', task: 'T1', start, end, lastModified: now, deleted: false }]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, []);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    TestRunner.assertEquals(monthly.dailyHours.length, 0,
        'dailyHours should be empty when no workdays selected');
    TestRunner.assertEquals(monthly.dailyCompletions.length, 0,
        'dailyCompletions should be empty when no workdays selected');
    TestRunner.assertEquals(monthly.dailyGaps.length, 0,
        'dailyGaps should be empty when no workdays selected');
    TestRunner.assertEquals(monthly.hours, 0,
        'monthly hours should be 0 when no workdays selected');
    TestRunner.assertEquals(monthly.gaps, 0,
        'monthly gaps should be 0 when no workdays selected');
});

TestRunner.test('handleLoadStats: workdaysInMonth is 0 when workdays is empty', async () => {
    await seedData({ tasks: [], entries: [] });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, []);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    TestRunner.assertEquals(monthly.workdaysInMonth, 0,
        'workdaysInMonth should be 0 when workdays is empty');
});

TestRunner.test('handleLoadStats: workdaysInMonth is positive with default Mon-Fri', async () => {
    await seedData({ tasks: [], entries: [] });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [1, 2, 3, 4, 5]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    TestRunner.assert(monthly.workdaysInMonth > 0,
        'workdaysInMonth should be positive with Mon-Fri workdays');
    TestRunner.assert(monthly.workdaysInMonth <= monthly.daysInMonth,
        'workdaysInMonth should not exceed calendar days in month');
});

TestRunner.test('handleLoadStats: workdays=[0,1,2,3,4,5,6] includes all days', async () => {
    await seedData({ tasks: [], entries: [] });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [0, 1, 2, 3, 4, 5, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    TestRunner.assertEquals(monthly.workdaysInMonth, monthly.daysInMonth,
        'workdaysInMonth should equal daysInMonth when all days are workdays');
});

TestRunner.test('handleLoadStats: excludes non-workday entries from monthlyHours', async () => {
    const now = new Date();
    // Find two days this month up to today with different days-of-week
    let includedDay = null, excludedDay = null;
    const includeDow = now.getDay(); // today's day-of-week is included
    for (let d = 1; d < now.getDate(); d++) {
        const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
        if (dow !== includeDow && excludedDay === null) excludedDay = { day: d, dow };
    }
    if (!excludedDay) {
        // Month just started with no prior days of different dow — skip test
        console.log('  (skipped: not enough prior days this month to test exclusion)');
        return;
    }
    includedDay = { day: now.getDate(), dow: includeDow };

    // Set workdays to only include today's day-of-week
    const workdays = [includeDow];

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [
            dayEntry(includedDay.day, 9, 11, 'gw_i1'),  // 2h on included day
            dayEntry(excludedDay.day, 9, 13, 'gw_i2')   // 4h on excluded day
        ]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, workdays);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    TestRunner.assertEquals(monthly.hours, 2,
        'Monthly hours should only count entries on selected workdays');
    const excludedInChart = monthly.dailyHours.some(d => d.x === excludedDay.day);
    TestRunner.assert(!excludedInChart,
        'Non-workday should not appear in dailyHours chart data');
});

TestRunner.test('handleLoadStats: excludes non-workday tasks from monthly task count', async () => {
    const now = new Date();
    // Find a prior day this month with a different day-of-week than today
    let excludedDay = null;
    const includeDow = now.getDay();
    for (let d = 1; d < now.getDate(); d++) {
        const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
        if (dow !== includeDow) { excludedDay = d; break; }
    }
    if (!excludedDay) {
        console.log('  (skipped: not enough prior days this month)');
        return;
    }

    const excludedDate = new Date(now.getFullYear(), now.getMonth(), excludedDay, 10, 0, 0, 0);
    const includedDate = new Date(now); includedDate.setHours(10, 0, 0, 0);

    await seedData({
        tasks: [
            { exid: 'T_INCL', description: 'Included', complete: true,
              lastModified: includedDate, deleted: false },
            { exid: 'T_EXCL', description: 'Excluded', complete: true,
              lastModified: excludedDate, deleted: false }
        ],
        entries: []
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [includeDow]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    TestRunner.assertEquals(monthly.tasksCompleted, 1,
        'Monthly task count should only count tasks completed on workdays');
});

TestRunner.test('handleLoadStats: dailyHours x-values are only workday calendar days', async () => {
    const now = new Date();
    const start = new Date(now); start.setHours(9, 0, 0, 0);
    const end   = new Date(now); end.setHours(10, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: now, deleted: false }],
        entries: [{ id: 'gw_j1', task: 'T1', start, end, lastModified: now, deleted: false }]
    });

    const workdays = [1, 2, 3, 4, 5];
    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, workdays);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    for (const point of monthly.dailyHours) {
        const date = new Date(now.getFullYear(), now.getMonth(), point.x);
        TestRunner.assert(workdays.includes(date.getDay()),
            `Day ${point.x} (dow=${date.getDay()}) should be a workday`);
    }
    for (const point of monthly.dailyGaps) {
        const date = new Date(now.getFullYear(), now.getMonth(), point.x);
        TestRunner.assert(workdays.includes(date.getDay()),
            `Gap entry for day ${point.x} should be a workday`);
    }
});

TestRunner.test('handleLoadStats: workdays=[0,6] includes weekend entries only', async () => {
    const now = new Date();
    // Find a Saturday or Sunday this month up to today
    let weekendDay = null;
    for (let d = 1; d <= now.getDate(); d++) {
        const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
        if (dow === 0 || dow === 6) { weekendDay = d; break; }
    }
    if (!weekendDay) {
        console.log('  (skipped: no weekend day found in current month up to today)');
        return;
    }

    const weekendStart = new Date(now.getFullYear(), now.getMonth(), weekendDay, 9, 0, 0, 0);
    const weekendEnd   = new Date(now.getFullYear(), now.getMonth(), weekendDay, 11, 0, 0, 0);

    await seedData({
        tasks: [{ exid: 'T1', description: 'Task', lastModified: weekendStart, deleted: false }],
        entries: [
            { id: 'gw_k1', task: 'T1', start: weekendStart, end: weekendEnd,
              lastModified: weekendStart, deleted: false }
        ]
    });

    const appContext = document.querySelector('app-context');
    setWorkdays(appContext, [0, 6]);
    await appContext.handleLoadStats();
    restoreDefaultWorkdays(appContext);

    const monthly = appContext.monthlyStats.value;
    const weekendEntry = monthly.dailyHours.find(d => d.x === weekendDay);
    TestRunner.assert(weekendEntry !== undefined,
        'Weekend entry should appear when workdays=[0,6]');
    TestRunner.assertEquals(weekendEntry.y, 2,
        'Weekend entry should show correct hours');
    TestRunner.assertEquals(monthly.hours, 2,
        'Monthly hours should include only weekend entries');
});
