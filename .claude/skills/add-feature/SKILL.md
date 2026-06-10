---
name: add-feature
description: Add a new feature to the timesheet project with tests. Drives the full workflow — understand, classify tests (Trophy Model), write tests first, implement, verify, commit. Use whenever a new feature or significant behaviour change is requested.
---

# Add Feature (Timesheet Project)

Implement a new feature following the project's Signal-based architecture and Trophy Testing Model. Tests are written before or alongside implementation — never after the commit.

## Trophy Testing Model

The trophy is widest at integration. Default to integration tests; unit tests are the exception.

```
        /‾‾‾‾‾‾‾\        ← E2E  (fewest: Playwright, outside Claude Code — note but don't block)
       /‾‾‾‾‾‾‾‾‾\
      /‾‾‾‾‾‾‾‾‾‾‾\      ← Integration  (most: JSDOM + fake-indexeddb, event-driven)
     /‾‾‾‾‾‾‾‾‾‾‾‾‾\
    /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
   /                 \   ← Unit  (few: isolated DB queries and pure logic only)
```

**Integration test** — exercise multiple layers in one test: dispatch a `updateState` CustomEvent as a component would, let `app-context.js` handle it, then assert the resulting signal value AND the DB state. This catches wiring bugs that unit tests never see.

**Unit test** — call a DB method or pure utility directly. Only when the logic is complex enough that integration coverage isn't practical (e.g. a new `timesheetDb.js` query method with edge cases).

**E2E test** — real browser, real interactions. Not runnable in Claude Code. At the end of the workflow, note which user journeys should be covered in Playwright.

### Test-type decision table

| What changed | Write this |
|---|---|
| New event handler in `app-context.js` | Integration |
| New DB query method with filtering/edge cases | Unit + Integration |
| New signal or computed in `app-context.js` | Integration |
| Pure utility / sort / parse function | Unit |
| CSS / visual only | E2E note only |
| Component subscribes to existing signal | Integration |

## Architecture Rules (read before touching any file)

- **Never import `TimesheetDB` in component files.** Only `app-context.js` may access the database.
- **New state follows the 5-step pattern:**
  1. Add signal to `app-context.js`
  2. Expose it in `stateProvider`
  3. Add a handler method (`handle*`)
  4. Add a `case` in `handleStateEvent()`
  5. Subscribe in the component via `ContextRequestEvent` + `effect()`
- **Components emit, never pull.** Use `emitEvent(this, 'eventType', payload)` — events bubble to `app-context.js` as `updateState` CustomEvents.
- **Read-only handlers** (no DB write, no state mutation) should `return` instead of `break` in the switch to skip `persistState()`.

## Workflow

Make a todo list and work through each step.

### 1. Understand

Re-read the feature request. If the scope touches more than two areas or the expected behaviour is ambiguous, ask one clarifying question before proceeding.

Identify:
- Which signals or events are new vs reused
- Whether a new DB method is needed
- Which files need to change

### 2. Classify tests

For each changed area, decide the test tier using the decision table above. Write the decision down — e.g. "new `handleFilterTasks` handler → integration test; new `searchArchivedTasks` DB method → unit test."

### 3. Write tests

Create `tests/<feature-name>.test.js`. Register it in `tests/test-runner-cli.js` by adding:
```javascript
await import('./<feature-name>.test.js');
```
to the imports block (around line 96).

**Integration test boilerplate:**
```javascript
import TimesheetDB from '../timesheetDb.js';

// Get the app-context element initialised by test-runner-cli.js
const appContext = document.querySelector('app-context');

async function clearDB() {
  const db = await TimesheetDB();
  const allTasks = await db.getAllTasksIncludingDeleted(1000);
  for (const task of allTasks) await db.permanentlyDeleteTask(task.exid);
}

TestRunner.test('feature: does the thing', async () => {
  await clearDB();

  // Dispatch as a component would
  appContext.dispatchEvent(new CustomEvent('updateState', {
    detail: { type: 'addTask', raw: 'My task #T1' },
    bubbles: true
  }));

  // Wait for async handler
  await new Promise(r => setTimeout(r, 100));

  // Assert signal
  const task = appContext.tasks.value.find(t => t.exid === 'T1');
  TestRunner.assert(task, 'Task should appear in signal');
  TestRunner.assertEquals(task.description, 'My task', 'Description should be extracted');

  // Assert DB
  const db = await TimesheetDB();
  const all = await db.getAllTasks();
  TestRunner.assert(all.find(t => t.exid === 'T1'), 'Task should be persisted');
});
```

IMPORTANT: `clearDB()` must use `getAllTasksIncludingDeleted()`, not `getAllTasks()`. `getAllTasks()` skips soft-deleted records — they stay in the DB and cause `ConstraintError` when the same exid is re-added in the next test.

**Unit test boilerplate (DB method):**
```javascript
import TimesheetDB from '../timesheetDb.js';

async function seedTasks(tasks) {
  const db = await TimesheetDB();
  const all = await db.getAllTasksIncludingDeleted(1000);
  for (const t of all) await db.permanentlyDeleteTask(t.exid);
  for (const t of tasks) await db.addTask(t);
}

TestRunner.test('db method: returns expected result', async () => {
  await seedTasks([
    { exid: 'A', description: 'Alpha', lastModified: new Date(), deleted: false }
  ]);
  const db = await TimesheetDB();
  const result = await db.myNewMethod('alpha');
  TestRunner.assertEquals(result.length, 1, 'Should find one match');
});
```

Run tests before implementation to confirm they fail for the right reason:
```bash
npm run test:unit
```

### 4. Implement

Make the changes. Follow the 5-step signal pattern for any new state. Keep components thin — they subscribe to signals and emit events; all logic lives in `app-context.js`.

### 5. Run tests

```bash
npm run test:unit
```

ALL tests must pass. If any fail, fix the **code**, not the test. Only modify a test if it is genuinely testing the wrong behaviour.

### 6. Complete project chores (required by CLAUDE.md)

- **Version:** bump `APP_VERSION` in `script.js` and `version` in `package.json` — patch for fixes, minor for features. They must match.
- **Service worker:** if new files were added, add them to the `assets` array in `serviceWorker.js`.
- **Docs:** update `TODO.md` (mark done / add new items) and `README.md` if user-facing behaviour changed.

### 7. Note E2E coverage

List the user journeys that should be covered by Playwright tests (to be written outside Claude Code):
- What does the user do?
- What should they see?

These are not blocking — include the list in the commit message or a comment in the test file.

### 8. Commit

```bash
git add <changed files>
git commit -m "$(cat <<'EOF'
<verb> <what changed>

<why — the problem this solves or the value it adds>

<brief note on test coverage: integration / unit / E2E pending>

https://claude.ai/code/session_XXXXX
EOF
)"
git push -u origin <branch>
```

## Wrap up

Summarise for the user:

* **Feature:** what was implemented
* **Tests written:**
  - ✅/⚠️ Integration tests: `tests/<name>.test.js` — N tests
  - ✅/⚠️ Unit tests: (if any)
  - 📋 E2E (Playwright, pending): list the journeys to cover
* **Test result:** `N/N passed`
* **Chores:** version bumped to X.Y.Z, service worker updated (yes/no), docs updated (yes/no)
