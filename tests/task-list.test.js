// task-list tests
import '../tasks/task-list.js';

TestRunner.test('task-list emits addTask event with form values', async () => {
  // Wait one frame to ensure component is upgraded
  await new Promise(r => requestAnimationFrame(r));
  return new Promise(resolve => {
    const component = document.querySelector('task-list');
    // Listen for the custom event
    component.addEventListener('addTask', (ev) => {
      TestRunner.assertEquals(ev.detail.raw, 'MyTask', 'raw field should match input');
      TestRunner.assertEquals(ev.detail.exid, '123', 'exid field should match input');
      TestRunner.assertEquals(ev.detail.client, 'ClientA', 'client field should match input');
      resolve();
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
