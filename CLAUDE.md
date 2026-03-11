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

- **script.js**: Update `APP_VERSION` constant (currently "1.8.0")
- **package.json**: Update `version` field (currently "1.8.0")
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

## Architecture: Signal-Based State Management

**All state management flows through `app-context.js`.** Components must never access IndexedDB or `TimesheetDB` directly.

### Pattern

1. **Components subscribe to signals** via the Context/Provider system (`ContextRequestEvent`). They receive signal references and set up `effect()` subscriptions for reactive rendering.
2. **Components emit events** to request state changes via `emitEvent(this, 'eventType', payload)`. These bubble up as `updateState` CustomEvents to `app-context.js`.
3. **`app-context.js` handles events** in `handleStateEvent()`, performs DB operations, updates signals, and calls `persistState()`.
4. **Read-only operations** (like `loadPreviousDay`) use `return` instead of `break` in the switch to skip `persistState()`.

### Rules

- **Never import `TimesheetDB` in component files** (`tasks/`, `timeline/`, or any custom element). Only `app-context.js` may import and use the database directly.
- **Never store private DB-derived state in components.** Expose it as a signal from `app-context.js` and subscribe in the component.
- **New features that need DB data** must: (1) add signals to `app-context.js`, (2) expose them in `stateProvider`, (3) add a handler method, (4) add a switch case in `handleStateEvent`, (5) have components subscribe to the new signals.

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

Since Claude Code doesn't support Playwright, unit tests use JSDOM + fake-indexeddb to simulate the DOM and IndexedDB in Node.js.

**Stack:** JSDOM, fake-indexeddb — see `tests/test-runner-cli.js` for the full setup boilerplate.

**Key patterns:**
- Simulate interactions via `element.click()` or `element.dispatchEvent(new Event(..., { bubbles: true }))`
- Await `new Promise(r => setTimeout(r, 100))` after state-changing actions
- Use `TestRunner.assert` / `TestRunner.assertEquals` for assertions
- Mock `Date` for time-based tests; restore afterwards
- Navigate with `window.location.hash = '#route'` then dispatch `hashchange`

**Limitations:** No real browser APIs (ServiceWorker, WebRTC, drag-drop, real timers). See existing tests in `tests/` for reference patterns.

Use Playwright (outside Claude Code) for visual regression, cross-browser, and complex interaction testing.

## Important Notes

- Never skip these chores even for "small" changes
- If a chore doesn't apply (e.g., no docs to update), note it in commit message
- When in doubt, over-document rather than under-document
- Keep TODO.md current - it's a living document
- Service worker caching issues are common; always verify version bumps work
