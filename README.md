# timesheet
A simple time tracking app

[Demo](https://peter-sharp.github.io/timesheet)

For detailed requirements and implementation tasks, see [REQUIREMENTS.md](./REQUIREMENTS.md)

## Features

- **Tasks** — Track tasks with priorities, statuses, and time entries
- **Timeline** — View and edit time entries; lazy-load historical days
- **Stats** — Weekly and monthly hours/task-completion summaries with goal tracking and daily trend charts (incl. % of completed tasks meeting their estimate); navigate to previous weeks/months with Prev/Next controls
- **Settings** — Customize theme color, focus interval, time snap, and weekly/monthly goals
- **File Sync** — Two-way sync with todo.txt / done.txt via File System Access API. Edits made in another editor are picked up within seconds (window focus + 5s polling) and merged line-by-line against the last-synced copy, so app writes never overwrite them. Deleting a line archives the task; lines typed without a `#exid` get one. After a reload use **Allow access** in the `...` menu if the browser asks again for file permission.

## Architecture Overview

*For detailed requirements and current tasks, see [REQUIREMENTS.md](./REQUIREMENTS.md)*

This timesheet application uses a modern architecture with Vanilla JavaScript signals and IndexedDB for persistent storage.

### Storage Architecture

The app uses a **multi-adapter storage system**:

- **IndexedDB**: Primary persistent storage for ALL tasks and time entries (current and historical)
- **localStorage**: UI state only (settings, current task, new entry, clients, version)
- **sessionStorage**: Deletion tracking for the current session

### Task Status

Tasks support four statuses selectable via the checkbox:
- **Not started** — empty checkbox (default)
- **In progress** — blue box with a play icon
- **On hold** — orange box with pause bars
- **Complete** — green box with a checkmark

To change status: **long press** (hold 500 ms) or **right-click** the checkbox to open the status picker dialog. A regular click still toggles between *Not started* and *Complete*.

### Key Features

#### Task Archiving
- Tasks can be **archived** to remove them from today's active list without deleting them
- Archived tasks remain in the database and appear in the add-task autocomplete
- Re-adding an archived task by name automatically unarchives it and restores it to today's list
- Archiving stops any active timer on the task

#### Editing Tasks
- Each task row ends with a chevron (›), always the right-most icon; it opens the **Edit task** screen (`#task/<id>`)
- Edit description, project, context, client, priority, due date and estimate; **Save** returns to the task list
- The edit screen slides in from the right and slides back out on return (off when reduced motion is preferred)
- Blank fields clear the property; the task ID is read-only
- Play/pause button next to the task ID starts/stops timing the task without leaving the screen
- Next to the estimate field, shows the % of the estimate taken so far (all-time hours incl. a running timer; recalculates as you type; highlighted over 100%)

#### Task Estimates
- Add an estimate (hours) with the todo.txt add-on `estimate:0.4`, or via the **More info → estimate** field
- Tasks without an estimate use an implicit default of **0.8h** (not written to todo.txt)
- The bottom of the task list shows the total estimate of all listed tasks
- The status bar shows the timed task's **all-time** hours vs its estimate (e.g. `1.20h / 0.80h (+0.40h over)`), updating live while recording
- A completed task "meets" its estimate when its all-time hours ≤ estimate; Stats shows the week/month rate and a daily % chart

#### Historical Data Browsing
- Both the **Tasks** and **Timeline** pages include a "Load previous day" button below today's content
- Each button press fetches one day of historical data from IndexedDB and displays it as a read-only dated section
- Historical sections show entries/tasks grouped by day with totals, visually dimmed to distinguish from today
- The button automatically finds the next day with data (skipping empty days) and disables when no more history exists
- Zero impact on initial load time — historical data is fetched only on demand

#### IndexedDB Implementation
- **All tasks and entries** are stored in IndexedDB with soft delete functionality
- Soft deletes use a `deleted` flag to preserve data and allow restoration
- Daily loading optimizes performance by only loading today's modified items
- Full history is preserved and accessible through the archive browser and historical day browsing
- Modular plugin architecture for database schema management

#### Data Indexes
- Tasks are indexed by: `exid` (unique), `client`, `project`, `lastModified`, `deleted`
- Entries are indexed by: `id` (unique), `task`, `start`, `lastModified`, `deleted`
- Indexes enable efficient queries for today's items, searches, and pagination

#### Signal-Based Reactivity
- Vanilla JS signals drive UI updates throughout the application
- Context signals in `app-context.js` provide reactive state management
- Components subscribe to signals for automatic re-rendering on data changes

### Migration History

The application migrated from localStorage to IndexedDB in database versions 2 and 3:
- **Version 2**: Migrated archived tasks from `localStorage.timesheet.archivedTasks` to IndexedDB
- **Version 3**: Migrated archived entries from `localStorage.timesheet.archive` to IndexedDB
- **Current (Version 6)**: All tasks and entries live in IndexedDB with soft delete support

There is no longer a separate "archive" storage - all data resides in IndexedDB, and the archive browser provides filtered views of historical data.

## Running Tests

To serve the test runner (avoiding CORS issues), run:
```
pnpm run serve-tests
```
Then navigate to `http://localhost:3000/tests/index.html` to view and run the tests.
