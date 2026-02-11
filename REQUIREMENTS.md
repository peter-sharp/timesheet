# Timesheet App: Requirements & Development Tasks

This document outlines requirements and current development tasks for the Timesheet app.

## 👋 What is Timesheet?

Timesheet is a simple time tracking tool that helps you record and analyze your work time. You can see it in action at our [demo site](https://peter-sharp.github.io/timesheet).

## 🏗️ Current Architecture

The app uses a modern, signal-based architecture with IndexedDB for persistent storage:

### Storage Architecture
- **IndexedDB**: Primary storage for ALL tasks and time entries (both current and historical)
- **localStorage**: UI state only (settings, current task, new entry, clients, version)
- **sessionStorage**: Deletion tracking for the current session

### Key Implementation Details
- All tasks and entries are stored in IndexedDB with soft delete functionality (using a `deleted` flag)
- Daily loading optimizes performance by only loading today's modified items into memory
- Full data history is preserved in IndexedDB and accessible via the archive browser
- Vanilla JS signals provide reactive state management throughout the application
- Context signals in `app-context.js` drive UI updates automatically

### Migration History
- **Database Version 2**: Migrated archived tasks from localStorage to IndexedDB
- **Database Version 3**: Migrated archived entries from localStorage to IndexedDB
- **Current (Version 6)**: All data lives in IndexedDB; no separate archive storage

## 📋 What Needs to Be Done

### Signal-Based Architecture Refinements

#### UI Components
- [ ] **High priority**: Ensure `timesheet-archive.js` fully uses context signals
  * Verify all references use signals (`archiveEntries`, `archiveBrowserPage`, `archiveBrowserPageSize`)
  * Confirm effects trigger re-renders on signal changes

- [ ] **High priority**: Ensure `archive-stats.js` fully uses context signals
  * Verify signals (`archiveEntries`, `archiveTasks`) replace any state object references
  * Confirm reactive effects update charts and statistics correctly

#### Event Handling
- [ ] **High priority**: Verify events update signals directly
  * Check `updateArchiveTaskPage`, `updateArchiveTasks`, and `deleteArchiveEntry` events
  * Ensure event listeners call context update functions

#### Data Operations
- [ ] **Critical priority**: Verify IndexedDB operations work correctly
  * Ensure `store.js` and `indexedDBAdapter` handle CRUD operations properly
  * Confirm pagination and search params flow from signals correctly

#### Code Quality
- [ ] **Medium priority**: Remove any remaining state object references from components
- [ ] **Low priority**: Remove outdated TODOs and unused code
- [ ] **Low priority**: Clean up migration-related `console.log` statements
- [ ] **Medium priority**: Optimize signal effects to prevent redundant renders
- [ ] **High priority**: Verify signal subscription cleanup in `disconnectedCallback`

### New Feature: Time Snapping

We want to add a feature that automatically snaps time entries together when they're close to each other:

- [x] **High priority**: When adding a new time entry, if it starts within 6 minutes after the previous entry ended, automatically set its start time to match the previous entry's end time
- [x] **Medium priority**: Add a setting to adjust this time-snapping interval (default: 6 minutes)
- [x] **Medium priority**: Make the time-snapping settings persist between sessions
- [ ] **Low priority**: Add a visual indicator when time-snapping has been applied

## 🧪 Testing

Run tests using:

```
pnpm run serve-tests
```

Then go to `http://localhost:3000/tests/index.html` to see the results.

When testing the archive migration, focus on:
- [ ] Pagination works correctly
- [ ] Search filtering returns the right results
- [ ] Data loads properly from IndexedDB
- [ ] UI updates when signals change

## ✅ Done Criteria

We'll consider the work complete when:

1. All archive components use signals instead of the state object
2. No references to the old state remain
3. All database operations work correctly
4. The UI updates properly when data changes
5. All tests pass
6. Documentation is updated
7. The new time-snapping feature works as expected

## 📚 References

This document follows practices from these free resources:

- [MDN Web Docs Writing Guidelines](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines) - Writing clear, accessible documentation
- [Atlassian Agile Requirements](https://www.atlassian.com/agile/product-management/requirements) - User-centered requirements approaches
- [The Good Docs Project](https://thegooddocsproject.dev/) - Open source documentation templates
- [Agile Alliance: Acceptance Testing](https://www.agilealliance.org/glossary/acceptance) - How to write good acceptance criteria
- [freeCodeCamp: Software Design Docs](https://www.freecodecamp.org/news/how-to-write-a-good-software-design-document-66fcf019569c/) - Making technical docs more accessible
