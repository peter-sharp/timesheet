// Integration tests: clicking status box on an in-progress task completes it AND updates status icon

const appCtx = document.querySelector('app-context');

function makeTask(exid, status = 'not-started') {
    return { exid, description: `Task ${exid}`, status, lastModified: new Date(), deleted: false, timingState: 'stop' };
}

function findTaskStatusEl(exid) {
    const li = [...document.querySelectorAll('task-list li')]
        .find(li => li.querySelector('[data-task]')?.innerText === exid);
    return li?.querySelector('task-status');
}

TestRunner.test('taskComplete: in-progress task becomes status complete', async () => {
    appCtx.tasks.value = [makeTask('CIP1', 'in-progress')];

    appCtx.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'taskComplete', exid: 'CIP1', complete: true },
        bubbles: true
    }));
    await new Promise(r => setTimeout(r, 50));

    const task = appCtx.tasks.value.find(t => t.exid === 'CIP1');
    TestRunner.assertEquals(task.complete, true, 'Task should be complete');
    TestRunner.assertEquals(task.status, 'complete', 'Status should be complete, not stale in-progress');
});

TestRunner.test('taskComplete: unchecking resets status to not-started', async () => {
    appCtx.tasks.value = [{ ...makeTask('CIP2', 'complete'), complete: true }];

    appCtx.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'taskComplete', exid: 'CIP2', complete: false },
        bubbles: true
    }));
    await new Promise(r => setTimeout(r, 50));

    const task = appCtx.tasks.value.find(t => t.exid === 'CIP2');
    TestRunner.assertEquals(task.complete, false, 'Task should not be complete');
    TestRunner.assertEquals(task.status, 'not-started', 'Status should reset to not-started');
});

TestRunner.test('clicking status box of in-progress task shows complete icon', async () => {
    appCtx.tasks.value = [makeTask('CIP3', 'in-progress')];
    await new Promise(r => setTimeout(r, 100));

    const statusEl = findTaskStatusEl('CIP3');
    TestRunner.assert(statusEl, 'task-status element should render for task');
    const statusBox = statusEl.shadowRoot.querySelector('.status-box');
    TestRunner.assertEquals(statusBox.dataset.status, 'in-progress', 'Starts in-progress');

    statusEl.shadowRoot.querySelector('input').click();
    await new Promise(r => setTimeout(r, 100));

    const task = appCtx.tasks.value.find(t => t.exid === 'CIP3');
    TestRunner.assertEquals(task.complete, true, 'Task should be complete after click');
    TestRunner.assertEquals(task.status, 'complete', 'Task status should be complete after click');

    const renderedBox = findTaskStatusEl('CIP3').shadowRoot.querySelector('.status-box');
    TestRunner.assertEquals(renderedBox.dataset.status, 'complete', 'Status icon should show complete after re-render');
});
