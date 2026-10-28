// Tests for the estimate total shown at the bottom of the task list
import { DEFAULT_ESTIMATE } from '../utils/estimate.js';

const appContext = document.querySelector('app-context');
const wait = (ms = 100) => new Promise(r => setTimeout(r, ms));

TestRunner.test('task list: shows total of task estimates, defaulting unestimated tasks', async () => {
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
