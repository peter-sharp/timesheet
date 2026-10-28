// Tests for the remaining estimate shown at the bottom of the task list
import { DEFAULT_ESTIMATE } from '../utils/estimate.js';

const appContext = document.querySelector('app-context');
const wait = (ms = 100) => new Promise(r => setTimeout(r, ms));

TestRunner.test('task list: shows total of task estimates, defaulting unestimated tasks', async () => {
    appContext.taskPastTotals.value = {};
    appContext.tasks.value = [
        { exid: 'ET1', description: 'One', estimate: '1.5' },
        { exid: 'ET2', description: 'Two' },
        { exid: 'ET3', description: 'Three', estimate: '2' }
    ];
    await wait();
    const el = document.querySelector('task-list [data-estimate-total]');
    TestRunner.assert(el, 'estimate total element should render');
    TestRunner.assertEquals(Number(el.getAttribute('hours')), Math.round((3.5 + DEFAULT_ESTIMATE) * 100) / 100, 'sums estimates');

    appContext.tasks.value = [];
    await wait();
    TestRunner.assertEquals(Number(el.getAttribute('hours')), 0, 'empty list totals 0');
});

TestRunner.test('task list: estimate total subtracts time taken (today + previous days), floored at 0', async () => {
    // Set past totals first so the app doesn't overwrite them with a DB load
    appContext.taskPastTotals.value = { ER1: 1, ER2: 0, ER3: 0 };
    appContext.tasks.value = [
        { exid: 'ER1', description: 'One', estimate: '2', total: 0.5 },   // 2 - 0.5 - 1 = 0.5
        { exid: 'ER2', description: 'Two', estimate: '1', total: 3 },     // over estimate -> 0
        { exid: 'ER3', description: 'Three', estimate: '1.5' }             // untouched -> 1.5
    ];
    await wait();
    const el = document.querySelector('task-list [data-estimate-total]');
    TestRunner.assertEquals(Number(el.getAttribute('hours')), 2, 'sums remaining estimates');

    appContext.tasks.value = [];
    appContext.taskPastTotals.value = {};
    await wait();
});
