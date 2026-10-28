// Two-way todo.txt/done.txt sync: external edits are picked up and app writes never clobber them
import TimesheetDB from '../timesheetDb.js';
import { planInbound, renderFiles } from '../syncEngine.js';
import { parseTodoTxt } from '../todoTxtFormat.js';

const appContext = document.querySelector('app-context');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

// In-memory stand-in for a FileSystemFileHandle
function fakeFile(text) {
  const file = { text, lastModified: 1 };
  file.handle = {
    queryPermission: async () => 'granted',
    getFile: async () => ({ lastModified: file.lastModified, text: async () => file.text }),
    createWritable: async () => {
      let buffer = '';
      return {
        write: async content => { buffer += content; },
        close: async () => { file.text = buffer; file.lastModified++; }
      };
    }
  };
  file.edit = text => { file.text = text; file.lastModified++; };
  return file;
}

// Handles can't be structured-cloned into fake-indexeddb, so serve them from a DB module override
async function withLinkedFiles(files, fn) {
  const override = () => ({
    upgrade() {},
    init: () => ({
      getFileHandle: async key => files[key] && { key, handle: files[key].handle, base: files[key].base },
      setFileSyncBase: async (key, base) => { if (files[key]) files[key].base = base; }
    })
  });
  TimesheetDB.modules.push(override);
  try {
    await fn();
  } finally {
    TimesheetDB.modules.splice(TimesheetDB.modules.indexOf(override), 1);
  }
}

async function seedTasks(tasks) {
  const db = await TimesheetDB();
  for (const task of await db.getAllTasksIncludingDeleted(Infinity)) {
    await db.permanentlyDeleteTask(task.exid);
  }
  for (const task of tasks) await db.addTask(task);
  return db;
}

const linesOf = text => parseTodoTxt(text).map(t => `${t.exid} ${t.description}`);

TestRunner.test('file sync: first sync keeps lines not in today\'s view and respects rollover', async () => {
  const oldModified = yesterday();
  const db = await seedTasks([
    { exid: 'FSOLD', description: 'Old task', lastModified: oldModified },
    { exid: 'FSTODAY', description: 'Today task', lastModified: new Date() }
  ]);
  appContext.tasks.value = [{ exid: 'FSTODAY', description: 'Today task', lastModified: new Date() }];

  const todo = fakeFile('#FSOLD Old task edited\n#FSTODAY Today task\n#FSEXT Typed in editor');
  await withLinkedFiles({ todoFile: todo }, () => appContext.syncFiles());

  const lines = linesOf(todo.text);
  TestRunner.assert(lines.includes('FSOLD Old task edited'), `old task line must survive, got ${todo.text}`);
  TestRunner.assert(lines.includes('FSEXT Typed in editor'), 'externally added line must survive');
  TestRunner.assert(appContext.tasks.value.some(t => t.exid === 'FSEXT'), 'new file task appears in today\'s view');
  TestRunner.assert(!appContext.tasks.value.some(t => t.exid === 'FSOLD'), 'old task stays out of today\'s view');

  const [old] = await db.getTasksByExids(['FSOLD']);
  TestRunner.assertEquals(old.description, 'Old task edited', 'old task updated in DB');
  TestRunner.assertEquals(new Date(old.lastModified).toISOString(), oldModified.toISOString(), 'old task timestamp preserved');
});

TestRunner.test('file sync: external edits, removals and exid-less lines are applied', async () => {
  await seedTasks([
    { exid: 'FSA', description: 'Alpha', lastModified: new Date() },
    { exid: 'FSB', description: 'Bravo', lastModified: new Date() }
  ]);
  appContext.tasks.value = [
    { exid: 'FSA', description: 'Alpha', lastModified: new Date() },
    { exid: 'FSB', description: 'Bravo', lastModified: new Date() }
  ];
  const todo = fakeFile('#FSA Alpha\n#FSB Bravo');
  const done = fakeFile('');

  await withLinkedFiles({ todoFile: todo, doneFile: done }, async () => {
    await appContext.syncFiles();
    todo.edit('#FSA Alpha renamed\nBuy milk +home');
    done.edit('x 2026-10-28 #FSB Bravo');
    await appContext.syncFiles();
  });

  const byExid = exid => appContext.tasks.value.find(t => t.exid === exid);
  TestRunner.assertEquals(byExid('FSA')?.description, 'Alpha renamed', 'edited line updates the task');
  TestRunner.assertEquals(byExid('FSB')?.complete, true, 'task moved to done.txt is completed');
  TestRunner.assertEquals(byExid('FSB')?.status, 'complete', 'status follows completion');

  const milk = appContext.tasks.value.find(t => t.description === 'Buy milk');
  TestRunner.assert(milk, 'exid-less line becomes a task');
  TestRunner.assertEquals(milk.project, 'home', 'project parsed');
  TestRunner.assert(todo.text.includes(`#${milk.exid} Buy milk`), `exid written back, got ${todo.text}`);

  // Deleting a line in the editor archives the task
  await withLinkedFiles({ todoFile: todo, doneFile: done }, async () => {
    todo.edit(`#${milk.exid} Buy milk +home`);
    await appContext.syncFiles();
  });
  TestRunner.assert(!byExid('FSA'), 'removed line drops task from today\'s view');
  const db = await TimesheetDB();
  const [archived] = await db.getTasksByExids(['FSA']);
  TestRunner.assertEquals(archived?.archived, true, 'removed line archives the task');
});

TestRunner.test('file sync: app edits merge with concurrent external edits', async () => {
  await seedTasks([
    { exid: 'FSC', description: 'Charlie', lastModified: new Date() },
    { exid: 'FSD', description: 'Delta', lastModified: yesterday() }
  ]);
  appContext.tasks.value = [{ exid: 'FSC', description: 'Charlie', lastModified: new Date() }];
  const todo = fakeFile('#FSC Charlie\n#FSD Delta');

  await withLinkedFiles({ todoFile: todo }, async () => {
    await appContext.syncFiles();
    todo.edit('#FSC Charlie\n#FSD Delta edited outside');
    appContext.tasks.value = [{ ...appContext.tasks.value[0], description: 'Charlie edited in app' }];
    await appContext.persistState({ fileSync: false });
    await appContext.syncFiles();
  });

  const lines = linesOf(todo.text);
  TestRunner.assert(lines.includes('FSC Charlie edited in app'), `app edit written, got ${todo.text}`);
  TestRunner.assert(lines.includes('FSD Delta edited outside'), 'external edit kept');
});

TestRunner.test('file sync: planInbound ignores unchanged lines and never resurrects deleted tasks', () => {
  const baseTasks = [{ exid: 'P1', description: 'one' }, { exid: 'P2', description: 'two' }];
  const fileTasks = [{ exid: 'P1', description: 'one' }, { exid: 'P2', description: 'two!' }, { exid: 'P3', description: 'gone' }];
  const dbTasks = [{ exid: 'P1', description: 'one in app' }, { exid: 'P2', description: 'two' }, { exid: 'P3', deleted: true }];
  const plan = planInbound({ baseTasks, fileTasks, dbTasks });
  TestRunner.assertEquals(plan.updates.map(u => u.exid).join(), 'P2', 'only the edited line updates');
  TestRunner.assertEquals(plan.additions.length, 0, 'deleted task not re-added');

  const first = planInbound({ baseTasks: null, fileTasks: [], dbTasks });
  TestRunner.assertEquals(first.removals.length, 0, 'no removals without a base');
});

TestRunner.test('file sync: renderFiles keeps completed lines in todo.txt when done.txt is not linked', () => {
  const tasks = [{ exid: 'R1', description: 'open' }, { exid: 'R2', description: 'closed', complete: true, completedDate: '2026-10-28' }];
  const { todo } = renderFiles({ fileTasks: [], viewTasks: tasks, dbTasks: [], doneLinked: false });
  TestRunner.assertEquals(todo, '#R1 open\nx 2026-10-28 #R2 closed', 'both lines kept');
});
