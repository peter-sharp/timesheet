// Integration tests: starting time tracking auto-sets status to in-progress

const appContext = document.querySelector('app-context');

function makeTask(exid, status = 'not-started') {
    return { exid, description: `Task ${exid}`, status, lastModified: new Date(), deleted: false, timingState: 'stop' };
}

function resetState() {
    appContext.newEntry.value = { task: null, annotation: '', start: null, end: null };
}

TestRunner.test('startTask: sets status to in-progress when task is not-started', async () => {
    resetState();
    appContext.tasks.value = [makeTask('ST1', 'not-started')];

    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'startTask', exid: 'ST1' },
        bubbles: true
    }));

    await new Promise(r => setTimeout(r, 50));

    const task = appContext.tasks.value.find(t => t.exid === 'ST1');
    TestRunner.assert(task, 'Task should exist in signal');
    TestRunner.assertEquals(task.status, 'in-progress', 'Status should become in-progress after starting timer');
});

TestRunner.test('startTask: does not change status when task is complete', async () => {
    resetState();
    appContext.tasks.value = [makeTask('ST2', 'complete')];

    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'startTask', exid: 'ST2' },
        bubbles: true
    }));

    await new Promise(r => setTimeout(r, 50));

    const task = appContext.tasks.value.find(t => t.exid === 'ST2');
    TestRunner.assert(task, 'Task should exist in signal');
    TestRunner.assertEquals(task.status, 'complete', 'Complete status should not be overridden when timer starts');
});

TestRunner.test('startTask: sets status to in-progress when task is on-hold', async () => {
    resetState();
    appContext.tasks.value = [makeTask('ST3', 'on-hold')];

    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'startTask', exid: 'ST3' },
        bubbles: true
    }));

    await new Promise(r => setTimeout(r, 50));

    const task = appContext.tasks.value.find(t => t.exid === 'ST3');
    TestRunner.assert(task, 'Task should exist in signal');
    TestRunner.assertEquals(task.status, 'in-progress', 'On-hold status should become in-progress when timer starts');
});

TestRunner.test('startTask: keeps in-progress status when already in-progress', async () => {
    resetState();
    appContext.tasks.value = [makeTask('ST4', 'in-progress')];

    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'startTask', exid: 'ST4' },
        bubbles: true
    }));

    await new Promise(r => setTimeout(r, 50));

    const task = appContext.tasks.value.find(t => t.exid === 'ST4');
    TestRunner.assert(task, 'Task should exist in signal');
    TestRunner.assertEquals(task.status, 'in-progress', 'Already in-progress task should remain in-progress');
});

TestRunner.test('startTask: only updates status of the started task, not others', async () => {
    resetState();
    appContext.tasks.value = [
        makeTask('ST5', 'not-started'),
        makeTask('ST6', 'not-started'),
    ];

    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'startTask', exid: 'ST5' },
        bubbles: true
    }));

    await new Promise(r => setTimeout(r, 50));

    const started = appContext.tasks.value.find(t => t.exid === 'ST5');
    const other = appContext.tasks.value.find(t => t.exid === 'ST6');

    TestRunner.assertEquals(started.status, 'in-progress', 'Started task should be in-progress');
    TestRunner.assertEquals(other.status, 'not-started', 'Other task status should be unchanged');
});

TestRunner.test('startTask: currentTask signal reflects updated status', async () => {
    resetState();
    appContext.tasks.value = [makeTask('ST7', 'not-started')];

    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'startTask', exid: 'ST7' },
        bubbles: true
    }));

    await new Promise(r => setTimeout(r, 50));

    TestRunner.assertEquals(
        appContext.currentTask.value.status,
        'in-progress',
        'currentTask signal should reflect the updated in-progress status'
    );
});
