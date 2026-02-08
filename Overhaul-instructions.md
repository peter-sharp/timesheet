# Overhaul Instructions

In this project we will completely restructure the timesheet to better fit the vision of a super simple place to keep track of time spent on tasks and projects.
the vision is broken up into the following goals in order of priority:

 - Be a wrapper around http://todotxt.org/ task lists
 - Track time spent on tasks
 - Focus on what needs to get done today
 - Visualize time and progress from the time entry level up to task and project level
 - Every task can be a project
 - Vanilla JS/CSS

## Architecture Principles

Based on [Functional-Light JavaScript](https://github.com/getify/Functional-Light-JS) by Kyle Simpson. These principles guide all code in this project.

### 1. Code as Communication
Code is primarily for humans to read, not computers to execute. Developers spend ~70% of maintenance time reading code, so **readability through familiar patterns** is paramount. Use recognizable FP patterns (`map`, `filter`, `reduce`) over custom loops.

### 2. Declarative Over Imperative
Describe **what** the outcome should be, not **how** to achieve it. This reduces implementation details cluttering comprehension.

```javascript
// Imperative (avoid)
let total = 0;
for (let i = 0; i < entries.length; i++) {
  total += entries[i].duration;
}

// Declarative (prefer)
const total = entries.reduce((sum, e) => sum + e.duration, 0);
```

### 3. Pure Functions
Functions should have:
- **Explicit inputs** - all dependencies passed as parameters
- **Predictable outputs** - same inputs always produce same outputs
- **No side effects** - don't modify external state

```javascript
// Impure (avoid)
function updateTask() {
  currentTask.modified = new Date(); // mutates external state
}

// Pure (prefer)
function updateTask(task) {
  return { ...task, modified: new Date() };
}
```

### 4. Immutability (Copy-Instead-of-Mutate)
Never mutate values. Create new values with changes applied:

```javascript
// Mutation (avoid)
tasks.push(newTask);
task.status = 'done';

// Immutable (prefer)
const updatedTasks = [...tasks, newTask];
const updatedTask = { ...task, status: 'done' };
```

### 5. Minimize Side Effects
Side effects (I/O, DOM updates, storage) cannot be eliminated but should be:
- **Isolated** - concentrated in specific locations, not scattered
- **Explicit** - obvious where they occur
- **Idempotent** - calling multiple times produces same result as once

### 6. Composition Over Complexity
Build complex operations from simple, reusable functions:

```javascript
// Composed pipeline
const todaysTasks = pipe(
  filterByDate(today),
  sortByPriority,
  formatForDisplay
)(tasks);
```

### 7. Pragmatic Balance
Apply FP where it genuinely improves code. Not every situation demands FP sophistication. **YAGNI** - don't add complexity that doesn't serve readability or maintainability.

---

## Phases
We will do this in phases.

### Phase 1

1. Remove every all ui code except for that which is needed for the tasks and timeline pages.
2. All tasks and timeenries will be stored in indexdb there will be no archive
3. UI state will still be tracked in localStorage 
4. Deletions in session storage
5. State management will be controlled solely by the Context and Signal utilities
6. Task list and timeline will only show entries last modified today. 
7. Likewise Totals will only be a total of today's task and time entry information.
8. A datalist will be added to the task description field pulling from the task list in the existing todo.txt format that's already supported e.g. #tasknumber task description client:aclient
9. We still want to keep unused  code as a reference so move it to an unused-code folder.


#### TODO

**Progress: 86/131 tasks completed (65.6%)**

##### 1. Remove Unused UI Code
- [x] Identify and list all UI components/pages currently in the project
- [x] Keep only tasks page and timeline page components
- [x] Move all other page components to unused-code folder (archive, reports, settings, etc.)
  - [x] archive/archive.js (archive reducer logic)
  - [x] archive/archive-stats.js (statistics component)
  - [x] archive/task-archive.js (archived tasks browser)
  - [x] archive/timesheet-archive.js (archived entries browser)
  - [x] sync/sync.js (sync setup)
  - [x] sync/sync-status.js (sync status for entries)
  - [x] sync/tasksyncstatus-list.js (sync status for tasks)
  - [x] components/graph-chart.js (move if not needed for timeline visualization)
  - [x] Settings page section from index.html
  - [x] Archive page section from index.html
  - [x] Sync page section from index.html
- [x] Move navigation elements for deleted pages to unused-code folder
- [x] Move unused routes to unused-code folder
- [x] Move unused CSS/styling for deleted components to unused-code folder
  - [x] style.css - Audit and remove archive-specific styles (CSS is general-purpose, kept as-is)
  - [x] style.css - Audit and remove settings-specific styles (CSS is general-purpose, kept as-is)
  - [x] style.css - Audit and remove sync-specific styles (CSS is general-purpose, kept as-is)
- [x] Update routing configuration to only include tasks and timeline routes
  - [x] index.html - Remove archive, settings, sync page sections
  - [x] index.html - Update footer navigation to only show tasks and timeline
  - [x] index.html - Remove popup menu items for archive, settings, sync
  - [x] hash-router.js - Remove route handlers for #archive, #settings, #sync (router is route-agnostic, no changes needed)
  - [x] style.css - Remove styles for archive, settings, sync components (CSS is general-purpose, kept as-is)
  - [x] script.js - Remove archive-related event listeners and initialization

##### 2. Data Storage Migration to IndexedDB
- [x] Create IndexedDB schema for tasks
  - [x] timesheetDb.js - Create tasks object store schema
  - [x] timesheetDb.js - Add indexes for lastModified field on tasks store
  - [x] timesheetDb.js - Implement CRUD methods for tasks (add, update, delete, get, getAll)
- [x] Create IndexedDB schema for time entries
  - [x] timesheetDb.js - Create entries object store schema
  - [x] timesheetDb.js - Add indexes for lastModified field on entries store
  - [x] timesheetDb.js - Implement CRUD methods for entries (add, update, delete, get, getAll)
- [x] Implement IndexedDB service/utility for CRUD operations on tasks
- [x] Implement IndexedDB service/utility for CRUD operations on time entries
  - [x] timesheetDb.js - Implement query method for "last modified today" filter
- [x] Remove archive-related database schemas and code (move to unused-code)
  - [x] timesheetStore.js - Remove archive object stores and related code
- [x] Migrate any existing data initialization to IndexedDB
  - [x] timesheetStore.js - Update to use IndexedDB for tasks and entries
  - [x] store.js - Adapter pattern already supports IndexedDB operations
  - [x] script.js - Updated to load from IndexedDB via store.read()
- [x] Remove all archive-related storage logic
  - [x] app-context.js - Removed archive signals (archiveTasks, archiveEntries, archiveOpen, etc.)

##### 2.1 Soft Deletes
All delete operations should be soft by default to allow for data recovery and undo functionality.

- [x] Add `deleted` boolean field to tasks schema
  - [x] timesheetDb.js - Add deleted field to task records
  - [x] timesheetDb.js - Add index on deleted field for efficient filtering
- [x] Add `deleted` boolean field to entries schema
  - [x] timesheetDb.js - Add deleted field to entry records
  - [x] timesheetDb.js - Add index on deleted field for efficient filtering
- [x] Update delete operations to set `deleted: true` instead of removing records
  - [x] timesheetDb.js - Modify deleteTask to set deleted flag
  - [x] timesheetDb.js - Modify deleteEntry to set deleted flag
- [x] Update query methods to exclude deleted records by default
  - [x] timesheetDb.js - getTasks should filter out deleted: true
  - [x] timesheetDb.js - getEntries should filter out deleted: true
  - [x] timesheetDb.js - getTasksModifiedToday should filter out deleted: true
  - [x] timesheetDb.js - getEntriesModifiedToday should filter out deleted: true
- [x] Add methods to query deleted records (for potential restore feature)
  - [x] timesheetDb.js - getDeletedTasks method
  - [x] timesheetDb.js - getDeletedEntries method
- [x] Add restore methods
  - [x] timesheetDb.js - restoreTask(exid) - sets deleted: false
  - [x] timesheetDb.js - restoreEntry(id) - sets deleted: false
- [x] Add permanent delete methods (for cleanup)
  - [x] timesheetDb.js - permanentlyDeleteTask(exid)
  - [x] timesheetDb.js - permanentlyDeleteEntry(id)

##### 3. State Management Restructure
- [x] Audit current state management usage
- [x] Ensure UI state (view preferences, filters, etc.) uses localStorage only
  - [x] timesheetStore.js - localStorage adapter stores only UI state (settings, newEntry, currentTask, clients)
- [x] Implement deletions tracking in sessionStorage
  - [x] sessionStorage adapter - Implement/verify deletions tracking (deleted, deletedTasks arrays)
- [x] Refactor all state management to use Context utility exclusively
- [x] Refactor all state management to use Signal utility exclusively
  - [x] model.js - Move entire Model/reducer pattern to unused-code folder
  - [x] tasks/tasks.js - Move reducer logic to unused-code folder (integrated into app-context.js)
  - [x] script.js - Remove Model.emit() calls and event listeners
  - [x] script.js - Refactor to use app-context signals exclusively
  - [x] app-context.js - Ensure all necessary signals are defined (tasks, entries, currentTask, settings, etc.)
  - [x] app-context.js - Add event handlers for all state changes (handleNewEntry, handleStartTask, etc.)
  - [x] app-context.js - Remove any references to archive signals (archiveTasks, archiveEntries, archiveOpen, etc.)
  - [x] tasks/task-list.js - Already dispatches events via emitEvent which app-context handles
  - [x] timeline/timesheet.js - Already dispatches events via emitEvent which app-context handles
  - [x] current-task.js - Already subscribes to currentTask signal from context
  - [x] All components - Already use signal.effect() for reactivity
- [x] Move any other state management patterns to unused-code (model.js, tasks/tasks.js moved)
- [x] Test state persistence and reactivity

##### 4. System Tests (Node.js)
Automated system tests using Node.js to verify end-to-end functionality. These tests allow Claude to run, check results, and fix bugs iteratively.

- [x] Set up Node.js test infrastructure
  - [x] Install test runner (Playwright)
  - [x] Create test directory structure and configuration (e2e/, playwright.config.js)
  - [x] Add npm test script for running system tests
  - [x] Create shared test helpers (e2e/helpers.js)
- [x] Task CRUD tests (e2e/task-crud.spec.js)
  - [x] Test creating a new task via the UI
  - [x] Test completing a task via checkbox (shadow DOM)
  - [x] Test soft-deleting a task
  - [x] Test that deleted tasks don't appear in the task list
  - [x] Test deleted task does not reappear after reload
- [x] Time entry CRUD tests (e2e/entry-crud.spec.js)
  - [x] Test creating a new time entry
  - [x] Test editing an existing time entry
  - [x] Test soft-deleting a time entry
  - [x] Test that deleted entries don't appear in the timeline
  - [x] Test that totals update when entry is added
- [x] State management tests (e2e/state-management.spec.js)
  - [x] Test that signals update the UI reactively
  - [x] Test that tasks persist in IndexedDB across page reloads
  - [x] Test that entries persist in IndexedDB across page reloads
  - [x] Test starting a task updates current task display
  - [x] Test stopping a task creates a time entry
- [x] Navigation and routing tests (e2e/navigation.spec.js)
  - [x] Test navigating between tasks and timeline pages
  - [x] Test that only tasks and timeline routes are accessible
  - [x] Test no archive/settings/sync routes exist
- [x] Today's data filter tests (e2e/today-filter.spec.js - placeholders for Phase 5)


##### 5. Filter to Today's Data
- [x] Create e2e tests that cover the today-filter use-case
  - [x] Test that only today's tasks appear in the task list
  - [x] Test that only today's entries appear in the timeline

- [x] Add "last modified today" filter to task list query
  - [x] timesheetStore.js - indexedDBAdapter.read() uses getTasksModifiedToday()
  - [x] timesheetDb.js - Use lastModified index for efficient filtering
- [x] Add "last modified today" filter to time entries query
  - [x] timesheetStore.js - indexedDBAdapter.read() uses getEntriesModifiedToday()
  - [x] timesheetDb.js - Use lastModified index for efficient filtering
- [x] Update task list UI to only display today's tasks
- [x] Update timeline UI to only display today's time entries
- [x] Ensure "last modified" timestamp is properly maintained on all updates
  - [x] app-context.js - Set lastModified timestamp on task create/update
  - [x] app-context.js - Set lastModified timestamp on entry create/update
  - [x] app-context.js - Ensure signals trigger updates when lastModified changes
- [x] Add midnight rollover check via requestIdleCallback in app-context.js

##### 6. Update Totals Calculation
- [ ] Create e2e tests that cover the today-filter total calculation use-case
  - [ ] Test that totals reflect only today's data
- [ ] Modify totals calculation to only include today's data
  - [ ] app-context.js - Update durationTotal signal to calculate from today's entries only
  - [ ] app-context.js - Update durationTotalGaps signal to calculate from today's entries only
  - [ ] utils/calcDuration.js - Ensure duration calculation filters for today
  - [ ] utils/calculateGaps.js - Ensure gap calculation filters for today
- [ ] Update task-level totals for today only
  - [ ] tasks/task-list.js - Calculate task durations from today's entries only
- [ ] Update time entry totals for today only
  - [ ] timeline/timesheet.js - Display totals for today's entries only
- [ ] Update UI to clearly indicate totals are for "today"
  - [ ] index.html - Add "Today's Total" label or similar to totals display
- [ ] Test totals accuracy with various scenarios

##### 7. Task Description Datalist
- [ ] Create e2e tests that cover the Task Description Datalist use-case
- [ ] timesheetDb.js - Add indexes for project field on tasks store
- [ ] update business logic in all files to account for new project field
- [ ] Create datalist element for task description input field
  - [ ] timeline/timesheet.js - Add `<datalist>` element to task description input
  - [ ] timeline/timesheet.js - Link datalist to input via list attribute
- [ ] Populate datalist with existing tasks from IndexedDB
  - [ ] timeline/timesheet.js - Query all tasks from IndexedDB on component load
  - [ ] timeline/timesheet.js - Subscribe to tasks signal to update datalist when tasks change
- [ ] Format datalist options in todo.txt format (#tasknumber description +some_project client:aclient)
  - [ ] timeline/timesheet.js - Format each task as `#${taskNumber} ${description} +${project} client:${client}`
  - [ ] Verify todo.txt format parsing in tasks/tasks.js
- [ ] Ensure datalist updates when new tasks are added
  - [ ] timeline/timesheet.js - Add effect listener to tasks signal to refresh datalist
- [ ] Test autocomplete functionality
- [ ] Ensure todo.txt format parsing is working correctly