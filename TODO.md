# TODO.md — File System Access API: Two-Way Sync with todo.txt / done.txt

## Features Implemented

### ✅ Lazy-load historical data — "Load previous day" (v1.8.0)

Implemented Option A from `docs/lazy-load-design-options.md`:
- Added "Load previous day" button to both Tasks and Timeline pages
- Historical data loads one day at a time from IndexedDB on button press
- Each day renders as a read-only section with date header and totals
- Skips empty days automatically; disables when no more history exists
- New IndexedDB queries: `getEntriesByDay`, `getPreviousDayWithEntries`, `getTasksByExids`
- 12 new unit tests covering all new DB queries

---

## Bug Fixes Applied

### ✅ Blank/timestamp-only tasks pollute autocomplete (fixed in v1.7.1)

**Root cause:** Three code paths in `app-context.js` created task objects without proper validation:
1. `handleNewEntry()` created tasks even when the task input was empty, and never set a `description` field.
2. `handleChangedEntry()` created stub tasks with only `{ exid, lastModified }` — missing `id` and `description`.
3. `handleAddTask()` fell back to `Date.now()` as the exid when no `#exid` was provided, producing entries like `#1772846833100` with no description.

These incomplete tasks were persisted to IndexedDB and appeared in both the timeline and task-list autocomplete dropdowns as meaningless timestamp IDs.

**Fix:**
- Added empty-string guards in `handleNewEntry()` and `handleChangedEntry()` to prevent creating tasks with blank names.
- Added `description` field to task objects created in both handlers.
- Added startup cleanup in `initialize()` that removes timestamp-only tasks from the DB (or adds a description if they have real time entries).
- Added datalist filters in both `timeline/timesheet.js` and `tasks/task-list.js` to skip blank tasks from rendering.

### ✅ On Hold status freezes page (fixed in v1.6.3)

**Root cause:** `task-status.js` `connectedCallback()` registered ~10 event listeners (on dialog
buttons, the label, and the shadow checkbox) every time it ran, but `disconnectedCallback()` only
removed 2 of them. In `task-list.js`, `renderTasks()` calls `elTotals.append(item)` for every task
on every render, which moves existing DOM elements and triggers `disconnectedCallback` →
`connectedCallback` cycles. Over normal usage, duplicate event listeners accumulated. When the user
clicked a status option (e.g. "On Hold"), every duplicate click handler fired, each dispatching a
`taskStatusChange` event and triggering a full state update + re-render cycle, causing an
exponentially growing cascade that froze the page.

**Fix (task-status.js):** Added a `_listenersReady` guard flag so event listeners are registered
only once in the component's lifetime. Subsequent `connectedCallback` calls (from DOM moves) still
re-initialize visual state from the `status` attribute but skip listener registration entirely.

### ✅ File sync bypasses daily rollover (fixed in v1.6.2)

**Root cause:** `syncInbound` called `mergeTasks(appTasks, fileTasks)` without filtering. After
a daily rollover `appTasks = []`, so every file task fell into the `!existing` path of
`mergeTasks` and received `lastModified: new Date()`. Those tasks were then placed directly
into `this.tasks.value`, making all old file tasks reappear in today's view.

**Fix (syncEngine.js):** Before calling `mergeTasks`, `syncInbound` now queries all DB task
exids and filters `fileTasks` to only pass through:
1. File tasks already in today's `appTasks` (metadata updates for today's work)
2. File tasks genuinely new — not present in the DB at all

Old tasks from a previous day that exist in the DB but aren't in today's view are skipped.
A new exported helper `filterRelevantFileTasks(fileTasks, appTaskExids, dbTaskExids)` encapsulates
this logic and is unit-tested in `tests/rollover-timestamp.test.js`.

---

## Context

The timesheet PWA manages tasks in IndexedDB but has no way to sync with external files. Users want to maintain a local `todo.txt` and `done.txt` (the [todo.txt standard](https://github.com/todotxt/todo.txt)) so tasks are editable from any text editor. The File System Access API (`showOpenFilePicker`, `FileSystemFileHandle.createWritable`) works on GitHub Pages — it only needs HTTPS (no special COOP/COEP headers). Browser support is Chromium-only (Chrome, Edge).

**Sync behaviour:** Two-way, on every change — but **only when the app is idle**. Outbound writes are scheduled via `requestIdleCallback` (the same pattern used by `_scheduleRolloverCheck` in `app-context.js`) so they never block user interaction. Inbound reads happen on `visibilitychange` (tab refocus) and initial load.

**Format:** The app's existing `#exid description +project client:name` format is valid todo.txt (everything after optional priority/date is free-form description). Completed tasks get the standard `x YYYY-MM-DD` prefix and live in `done.txt`.

---

## UX Research: File Picker Placement

**Constraint:** Linking files is a one-time setup action. It must not compete with the primary actions (editing tasks and time entries).

**Decision: Reuse the `...` popup menu pattern from the Original branch.** The Original branch already has a `<details class="popup-menu"><summary>...</summary>` inside the footer nav with links to Archive, Settings, and Sync. We bring this pattern to main — but only with the file sync items (no Archive/Settings/Sync pages since those were removed in the Overhaul). The `...` trigger is minimal, familiar, and already has full CSS support via `.popup-menu`, `.popup-menu__body`.

The menu contains:
- "Link todo.txt" / file name + "Unlink" toggle
- "Link done.txt" / file name + "Unlink" toggle

This sits in the nav alongside Tasks, Timeline, and current-task — visually lightweight, doesn't compete with main actions.

---

## Files to Create

### 1. `todoTxtFormat.js` — Format conversion (pure functions)

- `taskToLine(task)` — converts task object → todo.txt line
  - Incomplete: `#exid description +project client:name`
  - Complete: `x 2026-02-08 #exid description +project client:name`
- `lineToTask(line)` — parses a line back into `{ exid, description, project, client, complete }`
  - Detects `x YYYY-MM-DD` prefix for completion
  - Reuses `extract()` from [utils/extract.js](utils/extract.js) for `#exid`, `+project`, `client:` parsing
- `tasksToTodoTxt(tasks)` — filters incomplete → maps `taskToLine` → joins with `\n`
- `tasksToDoneTxt(tasks)` — filters complete → maps `taskToLine` → joins with `\n`
- `parseTodoTxt(text)` — splits on `\n` → filters blanks → maps `lineToTask`

### 2. `fileSync.js` — File System Access API wrapper

- `pickFile(description)` — calls `showOpenFilePicker({ types: [{ description, accept: { 'text/plain': ['.txt'] } }] })`
- `readFile(handle)` — `handle.getFile()` then `.text()`
- `writeFile(handle, content)` — `handle.createWritable()` → `.write(content)` → `.close()`
- `verifyPermission(handle)` — `queryPermission({ mode: 'readwrite' })`, if not `'granted'` then `requestPermission()`
- `storeHandle(key, handle, fileName)` — persists to IndexedDB `fileHandles` store
- `retrieveHandle(key)` — loads from IndexedDB
- `removeHandle(key)` — deletes from IndexedDB
- Feature detection: check `window.showOpenFilePicker` exists

### 3. `syncEngine.js` — Two-way merge logic

- `syncOutbound(tasks, db)` — retrieves handles from DB, verifies permission, writes `tasksToTodoTxt` → todo.txt, `tasksToDoneTxt` → done.txt. **Scheduled via `requestIdleCallback`** so writes never block the UI. Coalesces rapid edits automatically (each idle callback cancels any pending previous one).
- `syncInbound(appTasks, db)` — reads both files, parses, merges with app tasks. Returns merged array or `null` if no files linked.
- `mergeTasks(appTasks, fileTasks)` — merge by `exid` key:
  - Task in file only → add to app (new from external editor)
  - Task in both → file wins for text fields (description, project, client, complete); app wins for time-tracking fields (total, mostRecentEntry, entries)
  - Task in app only → keep (not deleted just because absent from file — avoids accidental data loss)
- Handles permission denial gracefully (silent no-op, shows status in menu)

### 4. `file-sync-menu.js` — Custom element for the popup menu

- Renders inside the `...` popup menu (`.popup-menu__body`)
- On connect: queries IndexedDB for existing handles, shows linked file names
- Unlinked state: "Link todo.txt" / "Link done.txt" buttons
- Linked state: file name + "Unlink" button for each
- On "Link" click: calls `pickFile()`, stores handle, triggers initial sync
- On "Unlink" click: removes handle from IndexedDB
- If `showOpenFilePicker` is unavailable: shows "Not supported in this browser"
- If permission denied on re-visit: shows "Permission needed — click to re-grant"

### 5. `e2e/file-sync-format.spec.js` — Format conversion tests

### 6. `e2e/file-sync-merge.spec.js` — Merge logic tests

### 7. `e2e/file-sync-menu.spec.js` — Menu UI tests

---

## Files to Modify

### 8. [timesheetDb.js](timesheetDb.js) — Add fileHandles store

- Bump `version` from `5` to `6` (line 68)
- Add new `fileHandlesDb` module via `TimesheetDB.modules.push()`:
  - `upgrade()`: create `fileHandles` object store with `keyPath: 'key'` (only if not exists)
  - `init()`: expose `putFileHandle(key, handle, fileName)`, `getFileHandle(key)`, `deleteFileHandle(key)`
- `FileSystemFileHandle` is structured-clonable, so it stores directly in IndexedDB

### 9. [app-context.js](app-context.js) — Hook sync into state lifecycle

- Import `syncOutbound` and `syncInbound` from `syncEngine.js`
- In `persistState()` (line 500): after `store.write()`, schedule `syncOutbound(this.tasks.value)` via `requestIdleCallback` (cancel any previously pending idle callback to coalesce rapid changes)
- In `connectedCallback()` (line 115): add `visibilitychange` listener that schedules `syncInbound()` via `requestIdleCallback` when tab regains focus, merges result into `this.tasks`
- In `initialize()`: after loading state, schedule `syncInbound()` via `requestIdleCallback` for initial file read (app renders first, syncs when idle)

### 10. [index.html](index.html) — Add `...` popup menu to footer nav

Add a new `<li>` to the nav `<ul>` (after the Timeline link, before current-task), reusing the exact popup menu pattern from the Original branch:
```html
<li>
  <details class="popup-menu">
    <summary>...</summary>
    <div class="popup-menu__body">
      <file-sync-menu></file-sync-menu>
    </div>
  </details>
</li>
```
The app icon `<h1>` stays unchanged as a decorative element.

### 11. [script.js](script.js) — Import new component, bump version

- Add `import "./file-sync-menu.js";`
- Bump `APP_VERSION` from `"1.4.0"` to `"1.5.0"`

### 12. [serviceWorker.js](serviceWorker.js) — Cache new files

Add to assets array:
```
"./todoTxtFormat.js",
"./fileSync.js",
"./syncEngine.js",
"./file-sync-menu.js",
```

### 13. [style.css](style.css) — Menu component styles

```css
file-sync-menu {
  display: block;
  white-space: nowrap;
  font-size: 0.85rem;
}
file-sync-menu button {
  font-size: 0.85rem;
}
```

### 14. [e2e/helpers.js](e2e/helpers.js) — Test helpers

- Update `seedIndexedDB` to use DB version 6
- Add `seedFileHandle(page, key, fileName)` helper for menu UI tests

---

## Tests

### Format conversion (`e2e/file-sync-format.spec.js`)

Run in-browser via `page.evaluate()` importing `todoTxtFormat.js`:

- [ ] `taskToLine` — incomplete task with all fields
- [ ] `taskToLine` — incomplete task with missing optional fields (no project, no client)
- [ ] `taskToLine` — completed task includes `x YYYY-MM-DD` prefix
- [ ] `lineToTask` — parses line with `#exid`, `+project`, `client:name`
- [ ] `lineToTask` — parses line with only description (no tags)
- [ ] `lineToTask` — parses completed line (`x 2026-02-08 ...`)
- [ ] `tasksToTodoTxt` — filters out completed tasks, joins with newlines
- [ ] `tasksToDoneTxt` — filters out incomplete tasks, joins with newlines
- [ ] `parseTodoTxt` — handles empty lines and whitespace
- [ ] Round-trip: `lineToTask(taskToLine(task))` preserves all fields

### Merge logic (`e2e/file-sync-merge.spec.js`)

Run in-browser via `page.evaluate()` importing `syncEngine.js`:

- [ ] New task in file only → added to app
- [ ] Task in both, file has updated description → description updated in app
- [ ] Task in both, file marks complete → app task marked complete
- [ ] Task in app only (not in file) → preserved (no data loss)
- [ ] Completed task in done.txt → imported as complete
- [ ] Task moved from todo.txt to done.txt → app task updated to complete
- [ ] App time-tracking fields (total, mostRecentEntry) preserved after merge
- [ ] Empty file → no tasks added, existing app tasks preserved

### Menu UI (`e2e/file-sync-menu.spec.js`)

- [ ] Popup menu opens when clicking footer app icon
- [ ] "Link todo.txt" and "Link done.txt" buttons visible
- [ ] After seeding `fileHandles` store: shows linked file name and "Unlink" button
- [ ] Menu hidden/disabled message when `showOpenFilePicker` not available (test via `page.evaluate` to delete the API)

---

## Bug-Fixing Strategy

1. Run `pnpm test` after each implementation phase (not just at the end)
2. **Format tests fail:** Fix `todoTxtFormat.js` pure functions first — these have no dependencies
3. **Merge tests fail:** Fix `syncEngine.js` — check `exid` key matching and field priority logic
4. **Menu UI tests fail:** Check DOM structure matches selectors, verify `seedFileHandle` helper writes correct DB version
5. **Existing tests fail (regression):** Most likely cause is the DB version bump (5→6). Fix by updating `seedIndexedDB` in helpers.js to open version 6. Second likely cause: the footer HTML change breaking navigation tests — verify `hash-nav` selectors still match
6. Run full suite after all phases to confirm no regressions

---

## Git Commit

After all tests pass:

```
git add todoTxtFormat.js fileSync.js syncEngine.js file-sync-menu.js \
       timesheetDb.js app-context.js index.html script.js serviceWorker.js style.css \
       e2e/file-sync-format.spec.js e2e/file-sync-merge.spec.js e2e/file-sync-menu.spec.js \
       e2e/helpers.js
```

```
Implement two-way todo.txt file sync via File System Access API

Adds file picker menu (footer icon popup) to link local todo.txt and
done.txt files. Syncs outbound on every state change, inbound on tab
focus. Uses exid-based merge with file-wins for text, app-wins for
time-tracking fields. IndexedDB stores file handles for persistence.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## Implementation Order

1. `todoTxtFormat.js` + format tests → run tests
2. `fileHandlesDb` module in `timesheetDb.js` → run tests (check no regressions)
3. `fileSync.js` (API wrapper)
4. `syncEngine.js` + merge tests → run tests
5. `file-sync-menu.js` + `index.html` + `style.css` changes + menu tests → run tests
6. `app-context.js` + `script.js` + `serviceWorker.js` integration → run full suite
7. Git commit
