# Overhaul Instructions

In this project we will completely restructure the timesheet to better fit the vision of a super simple place to keep track of time spent on tasks and projects.
the vision is broken up into the following goals in order of priority:

 - Be a wrapper around http://todotxt.org/ task lists
 - Track time spent on tasks
 - Focus on what needs to get done today
 - Visualize time and progress from the time entry level up to task and project level
 - Every task can be a project
 - Vanilla JS/CSS 
  

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

**Progress: 29/108 tasks completed (26.9%)**

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
- [ ] Create IndexedDB schema for tasks
  - [ ] timesheetDb.js - Create tasks object store schema
  - [ ] timesheetDb.js - Add indexes for lastModified field on tasks store
  - [ ] timesheetDb.js - Implement CRUD methods for tasks (add, update, delete, get, getAll)
- [ ] Create IndexedDB schema for time entries
  - [ ] timesheetDb.js - Create entries object store schema
  - [ ] timesheetDb.js - Add indexes for lastModified field on entries store
  - [ ] timesheetDb.js - Implement CRUD methods for entries (add, update, delete, get, getAll)
- [ ] Implement IndexedDB service/utility for CRUD operations on tasks
- [ ] Implement IndexedDB service/utility for CRUD operations on time entries
  - [ ] timesheetDb.js - Implement query method for "last modified today" filter
- [ ] Remove archive-related database schemas and code (move to unused-code)
  - [ ] timesheetStore.js - Remove archive object stores and related code (move to unused-code)
- [ ] Migrate any existing data initialization to IndexedDB
  - [ ] timesheetStore.js - Update to use IndexedDB for tasks and entries
  - [ ] store.js - Ensure adapter pattern supports IndexedDB operations
  - [ ] script.js - Update initialization to load from IndexedDB instead of localStorage for tasks/entries
- [ ] Remove all archive-related storage logic (move to unused-code)

##### 3. State Management Restructure
- [x] Audit current state management usage
- [ ] Ensure UI state (view preferences, filters, etc.) uses localStorage only
- [ ] Implement deletions tracking in sessionStorage
  - [ ] sessionStorage adapter - Implement/verify deletions tracking (deleted, deletedTasks arrays)
- [ ] Refactor all state management to use Context utility exclusively
- [ ] Refactor all state management to use Signal utility exclusively
  - [ ] model.js - Move entire Model/reducer pattern to unused-code folder
  - [ ] script.js - Remove Model.emit() calls and event listeners
  - [ ] script.js - Refactor to use app-context signals exclusively
  - [ ] app-context.js - Ensure all necessary signals are defined (tasks, entries, currentTask, settings, etc.)
  - [ ] app-context.js - Remove any references to archive signals (archiveTasks, archiveEntries, archiveOpen, etc.)
  - [ ] tasks/task-list.js - Update to dispatch events to app-context instead of Model
  - [ ] timeline/timesheet.js - Update to dispatch events to app-context instead of Model
  - [ ] current-task.js - Ensure it subscribes to currentTask signal from context
  - [ ] All components - Replace Model.listen() with signal.effect() or signal.addEventListener('change')
- [ ] Move any other state management patterns to unused-code (Redux, MobX, etc. if present)
- [ ] Test state persistence and reactivity

##### 4. Filter to Today's Data
- [ ] Add "last modified today" filter to task list query
  - [ ] tasks/task-list.js - Add filter logic to query only tasks with lastModified = today
  - [ ] timesheetDb.js - Use lastModified index for efficient filtering
- [ ] Add "last modified today" filter to time entries query
  - [ ] timeline/timesheet.js - Add filter logic to query only entries with lastModified = today
  - [ ] timesheetDb.js - Use lastModified index for efficient filtering
- [ ] Update task list UI to only display today's tasks
- [ ] Update timeline UI to only display today's time entries
- [ ] Ensure "last modified" timestamp is properly maintained on all updates
  - [ ] tasks/tasks.js - Set lastModified timestamp on task create/update
  - [ ] timeline/timesheet.js - Set lastModified timestamp on entry create/update
  - [ ] app-context.js - Ensure signals trigger updates when lastModified changes

##### 5. Update Totals Calculation
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

##### 6. Task Description Datalist
- [ ] Create datalist element for task description input field
  - [ ] timeline/timesheet.js - Add `<datalist>` element to task description input
  - [ ] timeline/timesheet.js - Link datalist to input via list attribute
- [ ] Populate datalist with existing tasks from IndexedDB
  - [ ] timeline/timesheet.js - Query all tasks from IndexedDB on component load
  - [ ] timeline/timesheet.js - Subscribe to tasks signal to update datalist when tasks change
- [ ] Format datalist options in todo.txt format (#tasknumber description client:aclient)
  - [ ] timeline/timesheet.js - Format each task as `#${taskNumber} ${description} client:${client}`
  - [ ] Verify todo.txt format parsing in tasks/tasks.js
- [ ] Ensure datalist updates when new tasks are added
  - [ ] timeline/timesheet.js - Add effect listener to tasks signal to refresh datalist
- [ ] Test autocomplete functionality
- [ ] Ensure todo.txt format parsing is working correctly