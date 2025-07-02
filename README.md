# timesheet
A simple time tracking app

[Demo](https://peter-sharp.github.io/timesheet)

## Migration Plan for Archive Section to Vanilla JS Signals and IndexedDB

This document outlines the remaining steps required to complete the migration of the archive section from a centralized state object to using Vanilla JavaScript signals and direct IndexedDB integration.

### Current Status

- Signals introduced for `archiveTasks`, `archiveEntries`, and `totalPages`.
- IndexedDB adapter updated for pagination and search filtering.
- `app-context.js` provides context signals.
- `task-archive.js` partially integrated with signals and context.

### Remaining Steps

1. Complete Signal Integration in Archive Components  
   - **timesheet-archive.js**  
     - Replace state object references with context signals (`archiveEntries`, `archiveBrowserPage`, `archiveBrowserPageSize`).  
     - Add effects to auto-trigger re-renders on signal changes.  
   - **archive-stats.js**  
     - Use context signals (`archiveEntries`, `archiveTasks`) instead of state object.  
     - Add effects to update charts and statistics reactively.  

2. Update Event Handling and Emission  
   - Ensure events (`updateArchiveTaskPage`, `updateArchiveTasks`, `deleteArchiveEntry`, etc.) update signals directly.  
   - Modify event listeners to call context update functions.  

3. Refactor Store and IndexedDB Adapter  
   - Verify `store.js` and `indexedDBAdapter` handle CRUD operations correctly.  
   - Ensure pagination/search parameters (`archivedTasksSearchTerm`, `archiveBrowserTaskPage`, `archiveBrowserTaskPageSize`) flow from signals.  

4. Remove Legacy State Management  
   - Delete references to the old state object (`model.state`) in archive components.  
   - Remove legacy TODOs and unused code.  

5. Testing and Validation  
   - Test pagination, search filtering, and data loading from IndexedDB.  
   - Confirm signals drive UI updates without regressions.  

6. Cleanup and Optimization  
   - Remove migration `console.log` statements.  
   - Optimize signal effects to prevent redundant renders.  
   - Ensure signal subscription cleanup in `disconnectedCallback`.  

7. Documentation and Finalization  
   - Update documentation to reflect the new signal-based architecture.  
   - Document signal usage and IndexedDB integration for maintainability.

## Running Tests

To serve the test runner (avoiding CORS issues), run:
```
pnpm run serve-tests
```
Then navigate to `http://localhost:3000/tests/index.html` to view and run the tests.
