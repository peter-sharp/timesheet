# Claude Development Guidelines

This document contains important instructions for AI assistants (Claude) working on this codebase.

## Chores Required for Each Feature Commit

After implementing any feature or bug fix, **ALWAYS** complete the following chores before committing:

### 1. Update Documentation

- **README.md**: Update if user-facing features changed or installation steps are affected
- **TODO.md**: Mark completed items as done, remove if no longer relevant, add new items if discovered during implementation
- **REQUIREMENTS.md**: Update if requirements have evolved or been refined

### 2. Bump Version Numbers

Update the following version numbers (increment patch version for bug fixes, minor version for features):

- **script.js**: Update `APP_VERSION` constant (currently "1.5.1")
- **package.json**: Update `version` field (currently "1.5.1")
- **⚠️ IMPORTANT**: script.js and package.json versions **MUST match**
- **timesheetStore.js**: Update `APP_VERSION` constant (currently "2.0") - only if storage schema changes

### 3. Update Service Worker Assets

If you added any new files (JavaScript, CSS, HTML, images, etc.), update the `assets` array in **serviceWorker.js** to include them. This ensures the files are cached for offline use.

Check for:
- New JavaScript modules
- New CSS files
- New images or icons
- New HTML files
- New utility functions in utils/

### 4. Run All Available Tests

Before committing, run tests to ensure nothing broke:

```bash
# Run unit tests (includes rollover tests, database tests, etc.)
npm run test:unit

# Run specific test suites if needed
npm run test:prev-tasks
```

**⚠️ CRITICAL: ALL tests must pass before committing.**

If tests fail:
1. **Fix the code first, not the test** - Failing tests indicate bugs in the implementation
2. Only modify tests if they're testing incorrect behavior or are genuinely broken
3. Never commit with failing tests
4. Never skip or disable tests without explicit user approval

Common test issues:
- `CustomEvent` errors: Check Signal.js event dispatching
- Timeouts: Check for missing awaits or infinite loops
- Assertion failures: The code doesn't match expected behavior - fix the code

### 5. Verify Functionality

- Test the changed functionality manually if possible
- Check browser console for errors
- Verify service worker updates correctly
- Test offline functionality if service worker was updated

## Commit Message Format

Use descriptive commit messages that explain:
1. What was changed
2. Why it was changed (the problem being solved)
3. Any important implementation details

Always include the session URL at the end:
```
https://claude.ai/code/session_XXXXX
```

## Service Worker Asset Management

The `assets` array in serviceWorker.js should mirror the actual file structure. Currently cached files:

**Root level:**
- Core: script.js, app-context.js, store.js, style.css
- Database: timesheetDb.js, timesheetStore.js
- Sync: fileSync.js, syncEngine.js, file-sync-menu.js
- Routing: hash-nav.js, hash-router.js
- Data: todoTxtFormat.js, model.js, media.js
- Components: current-task.js, time-duration.js, pie-progress.js

**Subdirectories:**
- tasks/: task-list.js, task-status.js, tasks.js
- timeline/: timesheet.js
- utils/: All utility functions (Signal.js, Context.js, etc.)

**Assets:**
- Icons: check.svg, delete.svg, pause.svg, play.svg, icon.svg, favicon.ico
- manifest.json

## Testing Strategy

**This project uses the Trophy Testing Model** 🏆

The trophy model emphasizes:
- **More end-to-end tests** that test real user workflows
- **Fewer unit tests** - only for critical utilities and business logic
- **Integration over isolation** - test how components work together, not in isolation

### Test Types

1. **E2E Tests** (playwright) 🎯 **PRIMARY**: Test full user workflows in real browser
   - User interactions, navigation, form submissions
   - Cross-component behavior and state management
   - Visual rendering and UI states

2. **Unit Tests** (test-runner-cli.js) ⚡ **MINIMAL**: Only for critical non-UI logic
   - Database operations (rollover, queries, indexing)
   - Core utilities and pure functions
   - Complex business logic that's hard to test via E2E

### Why Trophy Model?

- **More confidence**: E2E tests catch real bugs users will experience
- **Less brittleness**: Not coupled to implementation details
- **Better coverage**: Tests actual user value, not internal structure
- **Faster feedback**: One E2E test can cover multiple "units"

### Testing Guidelines

- **Write E2E first**: When adding features, start with E2E test for the user workflow
- **Unit test sparingly**: Only add unit tests for complex logic that's hard to verify via E2E
- **Avoid testing implementation**: Don't test internal component state or private methods
- **Test user behavior**: Focus on what users see and do, not how code is structured

## E2E Testing with JSDOM (Claude Code Environment)

Since Claude Code doesn't support Playwright, we simulate E2E tests using JSDOM. This approach provides E2E-like coverage while running in Node.js.

### Setup Requirements

**Current stack:**
- **JSDOM**: DOM simulation with full HTML/CSS/JS support
- **fake-indexeddb**: IndexedDB implementation for testing persistence
- **Native Node modules**: No additional libraries needed

### E2E Testing Strategy in JSDOM

#### 1. Full Application Setup

Each E2E test should:
```javascript
// Set up complete DOM with all components
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <body>
      <app-context>
        <nav>...</nav>
        <main>
          <task-list features="add,actions"></task-list>
          <timesheet-view></timesheet-view>
        </main>
      </app-context>
    </body>
  </html>
`);

// Initialize app with realistic state
const appContext = document.querySelector('app-context');
await appContext.initialize({
  tasks: [/* seed data */],
  entries: [/* seed data */],
  // ... full state
});

// Wait for components to connect and render
await new Promise(r => setTimeout(r, 100));
```

#### 2. Simulating User Interactions

**Form submissions:**
```javascript
const form = document.querySelector('form[data-new-task]');
form.elements.taskRaw.value = 'Build feature';
form.elements.exid.value = 'TASK-123';
form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
```

**Button clicks:**
```javascript
const startButton = document.querySelector('button[name="start"]');
startButton.click(); // or dispatchEvent(new Event('click', { bubbles: true }))
```

**Navigation:**
```javascript
// Hash-based routing
window.location.hash = '#timeline';
window.dispatchEvent(new Event('hashchange'));
await new Promise(r => setTimeout(r, 50)); // Wait for route change
```

**Input changes:**
```javascript
const input = document.querySelector('input[name="annotation"]');
input.value = 'Working on implementation';
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
```

#### 3. Verifying Results

**DOM state:**
```javascript
// Check what user sees
const taskItems = document.querySelectorAll('.task-item');
TestRunner.assertEquals(taskItems.length, 1, 'One task should be visible');

const taskDescription = document.querySelector('.task-item__description');
TestRunner.assertEquals(
  taskDescription.textContent,
  'Build feature',
  'Task description should be rendered'
);

// Check element visibility
const modal = document.querySelector('.modal');
TestRunner.assert(!modal.hasAttribute('hidden'), 'Modal should be visible');
```

**Application state:**
```javascript
// Verify state was updated correctly
const appContext = document.querySelector('app-context');
TestRunner.assertEquals(
  appContext.tasks.value.length,
  1,
  'Task should be in state'
);

// Verify persistence
const db = await TimesheetDB();
const savedTasks = await db.getAllTasks();
TestRunner.assertEquals(savedTasks.length, 1, 'Task should be persisted');
```

**Time-based behavior:**
```javascript
// Test timing-dependent features
const mockNow = new Date('2026-02-17T10:00:00');
const originalDate = global.Date;
global.Date = class extends originalDate {
  constructor() { return mockNow; }
};

// Run time-dependent code...
// Verify behavior at specific time

global.Date = originalDate; // Restore
```

#### 4. Complete E2E Test Example

```javascript
TestRunner.test('User can add task, start timer, and stop timer', async () => {
  // Setup: Fresh app state
  const appContext = document.querySelector('app-context');
  await appContext.initialize({
    tasks: [],
    entries: [],
    newEntry: {},
    currentTask: {},
    settings: { timeSnapThreshold: 6 }
  });

  // Step 1: User adds a task
  const form = document.querySelector('form[data-new-task]');
  form.elements.taskRaw.value = 'Write E2E tests';
  form.dispatchEvent(new Event('submit', { bubbles: true }));

  await new Promise(r => setTimeout(r, 100)); // Let state update

  // Verify: Task appears in list
  let taskItem = document.querySelector('[data-exid]');
  TestRunner.assert(taskItem, 'Task should appear in list');
  TestRunner.assertEquals(
    taskItem.querySelector('[data-description]').textContent,
    'Write E2E tests',
    'Description should match'
  );

  // Step 2: User starts timer
  const startButton = taskItem.querySelector('button[name="start"]');
  startButton.click();

  await new Promise(r => setTimeout(r, 100));

  // Verify: Timer is running
  taskItem = document.querySelector('[data-exid]');
  TestRunner.assertEquals(
    taskItem.dataset.state,
    'active',
    'Task should be active'
  );
  TestRunner.assert(
    startButton.hidden,
    'Start button should be hidden'
  );

  // Step 3: User stops timer
  const stopButton = taskItem.querySelector('button[name="stop"]');
  TestRunner.assert(!stopButton.hidden, 'Stop button should be visible');
  stopButton.click();

  await new Promise(r => setTimeout(r, 100));

  // Verify: Entry was created
  const db = await TimesheetDB();
  const entries = await db.getEntriesModifiedToday();
  TestRunner.assertEquals(entries.length, 1, 'Entry should be created');
  TestRunner.assertEquals(
    entries[0].task,
    taskItem.dataset.exid,
    'Entry should reference task'
  );

  // Verify: Timer is stopped
  taskItem = document.querySelector('[data-exid]');
  TestRunner.assertEquals(
    taskItem.dataset.state,
    'inactive',
    'Task should be inactive'
  );
});
```

#### 5. Testing Patterns

**Multi-page flows:**
```javascript
// Navigate through app
window.location.hash = '#tasks';
await waitForRoute();
// ... interact with tasks page

window.location.hash = '#timeline';
await waitForRoute();
// ... verify timeline updated

async function waitForRoute() {
  await new Promise(r => setTimeout(r, 100));
}
```

**Data persistence across sessions:**
```javascript
// Session 1: Create data
await addTaskAndEntry();
let db = await TimesheetDB();
let tasks = await db.getAllTasks();
TestRunner.assertEquals(tasks.length, 1);

// Session 2: Reload app (simulate refresh)
const appContext = document.querySelector('app-context');
const store = await import('../timesheetStore.js').then(m => m.default);
const freshState = await store.read();
await appContext.initialize(freshState);

// Verify data persisted
TestRunner.assertEquals(
  appContext.tasks.value.length,
  1,
  'Task should persist across sessions'
);
```

**Rollover and time-based features:**
```javascript
// Set yesterday's date
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

// Create data from yesterday
const db = await TimesheetDB();
await db.addTask({
  exid: 'OLD',
  description: 'Yesterday task',
  lastModified: yesterday
});

// Trigger rollover
const appContext = document.querySelector('app-context');
await appContext._reloadTodayData();

// Verify rollover behavior
const todaysTasks = appContext.tasks.value;
TestRunner.assertEquals(
  todaysTasks.length,
  0,
  'Yesterday task should not appear today'
);
```

### Limitations & Workarounds

**No visual rendering:**
- ❌ Can't test CSS layout, visual appearance
- ✅ Can test DOM structure, element visibility, classes
- ✅ Can test computed values via `getComputedStyle()` (limited in JSDOM)

**No real timers:**
- ❌ Can't test real-time behavior (setTimeout is instant in tests)
- ✅ Can mock Date and test at specific times
- ✅ Can manually advance time with test utilities

**No real browser APIs:**
- ❌ No ServiceWorker, Push Notifications, WebRTC
- ✅ Can mock APIs (localStorage, IndexedDB work via polyfills)
- ✅ Can test API calls with fetch mocks

**No real user events:**
- ❌ No actual mouse movements, keyboard with modifiers, drag-drop
- ✅ Can dispatch events manually
- ✅ Can test event handlers and bubbling

### When to Use Playwright Instead

Consider adding Playwright tests (run outside Claude Code) for:
- Visual regression testing
- Cross-browser compatibility
- Complex interactions (drag-drop, file uploads)
- Performance testing
- Real ServiceWorker behavior
- Testing on actual mobile devices

For Claude Code development, JSDOM E2E tests provide 80% of the value with full automation support.

## Important Notes

- Never skip these chores even for "small" changes
- If a chore doesn't apply (e.g., no docs to update), note it in commit message
- When in doubt, over-document rather than under-document
- Keep TODO.md current - it's a living document
- Service worker caching issues are common; always verify version bumps work
