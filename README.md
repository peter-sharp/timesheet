# timesheet
A simple time tracking app

[Demo](https://peter-sharp.github.io/timesheet)

For detailed requirements and implementation tasks, see [REQUIREMENTS.md](./REQUIREMENTS.md)

## Architecture Overview

*For detailed requirements and current tasks, see [REQUIREMENTS.md](./REQUIREMENTS.md)*

This timesheet application uses a modern architecture with Vanilla JavaScript signals and IndexedDB for persistent storage.

### Storage Architecture

The app uses a **multi-adapter storage system**:

- **IndexedDB**: Primary persistent storage for ALL tasks and time entries (current and historical)
- **localStorage**: UI state only (settings, current task, new entry, clients, version)
- **sessionStorage**: Deletion tracking for the current session

### Key Features

#### IndexedDB Implementation
- **All tasks and entries** are stored in IndexedDB with soft delete functionality
- Soft deletes use a `deleted` flag to preserve data and allow restoration
- Daily loading optimizes performance by only loading today's modified items
- Full history is preserved and accessible through the archive browser
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
