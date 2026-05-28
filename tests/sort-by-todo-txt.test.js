import sortByTodoTxt from '../utils/sortByTodoTxt.js';

// Helpers
const task = (overrides) => ({
    exid: 'test', description: 'test', id: 1, complete: false, ...overrides
});

TestRunner.test('incomplete tasks sort before complete tasks', () => {
    const complete = task({ complete: true, id: 2 });
    const incomplete = task({ complete: false, id: 1 });
    const result = [complete, incomplete].sort(sortByTodoTxt);
    TestRunner.assertEquals(result[0].complete, false, 'incomplete should be first');
    TestRunner.assertEquals(result[1].complete, true, 'complete should be last');
});

TestRunner.test('priority A sorts before priority B', () => {
    const b = task({ priority: 'B', id: 1 });
    const a = task({ priority: 'A', id: 2 });
    const result = [b, a].sort(sortByTodoTxt);
    TestRunner.assertEquals(result[0].priority, 'A', 'A should come first');
});

TestRunner.test('prioritised tasks sort before unprioritised', () => {
    const none = task({ id: 1 });
    const withPrio = task({ priority: 'Z', id: 2 });
    const result = [none, withPrio].sort(sortByTodoTxt);
    TestRunner.assertEquals(result[0].priority, 'Z', 'prioritised should come first');
});

TestRunner.test('older creationDate (Date object) sorts first', () => {
    const newer = task({ creationDate: new Date('2026-05-28'), id: 2 });
    const older = task({ creationDate: new Date('2026-01-01'), id: 1 });
    const result = [newer, older].sort(sortByTodoTxt);
    TestRunner.assertEquals(result[0].id, 1, 'older task should be first');
});

TestRunner.test('older creationDate (string from todo.txt) sorts first', () => {
    const newer = task({ creationDate: '2026-05-28', id: 2 });
    const older = task({ creationDate: '2026-01-01', id: 1 });
    const result = [newer, older].sort(sortByTodoTxt);
    TestRunner.assertEquals(result[0].id, 1, 'older task should be first');
});

TestRunner.test('Date object and string creationDate are compared at day granularity', () => {
    const fromFile = task({ creationDate: '2026-03-15', id: 1 });
    const fromApp = task({ creationDate: new Date('2026-05-01T09:00:00'), id: 2 });
    const result = [fromApp, fromFile].sort(sortByTodoTxt);
    TestRunner.assertEquals(result[0].id, 1, 'older (string) task should be first');
});

TestRunner.test('same creationDate day uses id as tiebreaker', () => {
    const second = task({ creationDate: new Date('2026-05-28T10:00:00'), id: 200 });
    const first = task({ creationDate: new Date('2026-05-28T08:00:00'), id: 100 });
    const result = [second, first].sort(sortByTodoTxt);
    TestRunner.assertEquals(result[0].id, 100, 'lower id (earlier creation) should be first');
});

TestRunner.test('tasks without creationDate fall back to mostRecentEntry', () => {
    const recent = task({ mostRecentEntry: new Date('2026-05-28'), id: 2 });
    const old = task({ mostRecentEntry: new Date('2026-01-01'), id: 1 });
    const result = [recent, old].sort(sortByTodoTxt);
    TestRunner.assertEquals(result[0].id, 1, 'older mostRecentEntry should be first');
});
