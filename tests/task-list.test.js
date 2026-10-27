// task-list tests
import '../tasks/task-list.js';

TestRunner.test('task-list emits addTask event with form values', async () => {
  // Wait one frame to ensure component is upgraded
  await new Promise(r => requestAnimationFrame(r));
  return new Promise(resolve => {
    const component = document.querySelector('task-list');
    // Listen for the updateState event (emitEvent dispatches updateState, not addTask)
    component.addEventListener('updateState', function onAddTask(ev) {
      if (ev.detail.type === 'addTask') {
        component.removeEventListener('updateState', onAddTask);
        TestRunner.assertEquals(ev.detail.raw, 'MyTask', 'raw field should match input');
        TestRunner.assertEquals(ev.detail.exid, '123', 'exid field should match input');
        TestRunner.assertEquals(ev.detail.client, 'ClientA', 'client field should match input');
        resolve();
      }
    });
    // Fill in the form fields
    const form = component.querySelector('[data-new-task]');
    form.elements.taskRaw.value = 'MyTask';
    form.elements.exid.value = '123';
    form.elements.client.value = 'ClientA';
    // Submit the form
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
});

TestRunner.test('task-list highlightMatch handles numeric exids from archived search results', async () => {
  await new Promise(r => requestAnimationFrame(r));
  const component = document.querySelector('task-list');
  const container = document.createElement('p');
  container.append(component.highlightMatch(663287, 'azbom'));
  TestRunner.assertEquals(container.textContent, '663287', 'Numeric exid should render as text without throwing');
  const matched = document.createElement('p');
  matched.append(component.highlightMatch(663287, '32'));
  TestRunner.assertEquals(matched.querySelector('mark')?.textContent, '32', 'Numeric exid match should be highlighted');
});
