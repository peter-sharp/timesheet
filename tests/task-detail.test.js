// Tests for the task detail drill-down: chevron link on each task row,
// <task-detail> edit form, and the updateTask handler in app-context
import '../tasks/task-detail.js';

const appContext = document.querySelector('app-context');
const wait = (ms = 100) => new Promise(r => setTimeout(r, ms));

function updateTask(detail) {
    appContext.dispatchEvent(new CustomEvent('updateState', {
        detail: { type: 'updateTask', ...detail }, bubbles: true
    }));
}

TestRunner.test('task detail: updateTask edits task properties in signal', async () => {
    appContext.tasks.value = [{ exid: 'TD1', description: 'Old', project: 'old_proj', client: 'acme', estimate: '0.5' }];
    updateTask({
        exid: 'TD1',
        description: 'New description',
        project: 'new_proj',
        context: 'office',
        client: 'globex',
        due: '2026-10-20',
        estimate: '2',
        priority: 'b'
    });
    await wait();
    const task = appContext.tasks.value.find(t => t.exid === 'TD1');
    TestRunner.assertEquals(task.description, 'New description', 'description updated');
    TestRunner.assertEquals(task.project, 'new_proj', 'project updated');
    TestRunner.assertEquals(task.context, 'office', 'context updated');
    TestRunner.assertEquals(task.client, 'globex', 'client updated');
    TestRunner.assertEquals(task.due, '2026-10-20', 'due updated');
    TestRunner.assertEquals(task.estimate, '2', 'estimate updated');
    TestRunner.assertEquals(task.priority, 'B', 'priority uppercased');
    TestRunner.assert(appContext.clients.value.some(c => c.name === 'globex'), 'new client added to clients');
});

TestRunner.test('task detail: updateTask clears blank fields and strips sigils', async () => {
    appContext.tasks.value = [{ exid: 'TD2', description: 'Keep', project: 'p', client: 'c', estimate: '1', priority: 'A' }];
    updateTask({ exid: 'TD2', description: 'Keep', project: '+my_proj', context: '@home', client: '', estimate: '', priority: '' });
    await wait();
    const task = appContext.tasks.value.find(t => t.exid === 'TD2');
    TestRunner.assertEquals(task.project, 'my_proj', '+ stripped from project');
    TestRunner.assertEquals(task.context, 'home', '@ stripped from context');
    TestRunner.assertEquals(task.client, '', 'client cleared');
    TestRunner.assertEquals(task.estimate, '', 'estimate cleared');
    TestRunner.assertEquals(task.priority, undefined, 'priority cleared');
});

TestRunner.test('task detail: chevron link is the right-most action on each task', async () => {
    const list = document.querySelector('task-list');
    list.setAttribute('features', 'add,actions');
    appContext.tasks.value = [{ exid: 'TD3', description: 'Chevron me' }];
    await wait();
    const li = list.querySelector('[data-exid="TD3"]');
    const actions = li.querySelector('[data-actions]');
    const last = actions.lastElementChild;
    TestRunner.assertEquals(last.getAttribute('name'), 'details', 'chevron should be last action');
    TestRunner.assertEquals(last.getAttribute('href'), '#task/TD3', 'chevron links to task detail');
    list.setAttribute('features', 'add');
});

TestRunner.test('task detail: drill-down form loads task and saves edits', async () => {
    const detail = document.createElement('task-detail');
    appContext.append(detail);
    appContext.tasks.value = [{ exid: 'TD4', description: 'Edit me', project: 'proj', estimate: '0.4' }];
    window.location.hash = '#task/TD4';
    window.dispatchEvent(new Event('hashchange'));
    await wait();

    const form = detail.querySelector('form');
    TestRunner.assert(!form.hidden, 'form should be shown for known task');
    TestRunner.assertEquals(detail.querySelector('[data-exid]').textContent, 'TD4', 'exid shown');
    TestRunner.assertEquals(form.elements.description.value, 'Edit me', 'description populated');
    TestRunner.assertEquals(form.elements.project.value, 'proj', 'project populated');
    TestRunner.assertEquals(form.elements.estimate.value, '0.4', 'estimate populated');

    form.elements.description.value = 'Edited';
    form.elements.client.value = 'initech';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait();

    const task = appContext.tasks.value.find(t => t.exid === 'TD4');
    TestRunner.assertEquals(task.description, 'Edited', 'description saved');
    TestRunner.assertEquals(task.client, 'initech', 'client saved');
    TestRunner.assertEquals(task.project, 'proj', 'unchanged project kept');
    TestRunner.assertEquals(window.location.hash, '#tasks', 'returns to task list after save');

    window.location.hash = '#task/UNKNOWN';
    window.dispatchEvent(new Event('hashchange'));
    await wait();
    TestRunner.assert(form.hidden, 'form hidden for unknown task');
    TestRunner.assert(!detail.querySelector('[data-not-found]').hidden, 'not found message shown');
    detail.remove();
    window.location.hash = '';
});
