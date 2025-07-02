# Timesheet App: What We're Building & Fixing

This document outlines our plan for the Timesheet app, focusing on two main areas:
1. Migrating the archive section to use Vanilla JS Signals and IndexedDB
2. Adding a new time-snapping feature

## 👋 What is Timesheet?

Timesheet is a simple time tracking tool that helps you record and analyze your work time. You can see it in action at our [demo site](https://peter-sharp.github.io/timesheet).

## 🚧 Current Status

We've started moving the archive section from using a central state object to a more modern approach with Vanilla JS Signals and IndexedDB:

- Created signals for `archiveTasks`, `archiveEntries`, and `totalPages`
- Updated IndexedDB to handle pagination and search filtering
- Set up context signals in `app-context.js`
- Partially integrated `task-archive.js` with signals

## 📋 What Needs to Be Done

### Archive Section Migration

#### Viewing Archived Time Entries
- [ ] **High priority**: Update `timesheet-archive.js` to use context signals instead of state object
  * Replace references to `archiveEntries`, `archiveBrowserPage`, and `archiveBrowserPageSize`
  * Add effects to automatically re-render when signals change
  
- [ ] **High priority**: Update `archive-stats.js` to use context signals
  * Replace state object references with `archiveEntries` and `archiveTasks` signals
  * Add reactive effects for charts and statistics updates

#### Event Handling
- [ ] **High priority**: Make events update signals directly
  * Update `updateArchiveTaskPage`, `updateArchiveTasks`, and `deleteArchiveEntry` events
  * Modify event listeners to call the right context update functions

#### Data Storage
- [ ] **Critical priority**: Verify IndexedDB operations work correctly
  * Ensure `store.js` and `indexedDBAdapter` handle CRUD operations properly
  * Make pagination and search params (`archivedTasksSearchTerm`, `archiveBrowserTaskPage`, etc.) flow from signals

#### Cleanup
- [ ] **Medium priority**: Remove old state object references from archive components
- [ ] **Low priority**: Remove TODOs and unused code
- [ ] **Low priority**: Delete `console.log` statements used during migration
- [ ] **Medium priority**: Optimize signal effects to prevent extra renders
- [ ] **High priority**: Add cleanup for signal subscriptions in `disconnectedCallback`

#### Documentation
- [ ] **Medium priority**: Update docs to explain the new signal-based architecture
- [ ] **Medium priority**: Document how signals and IndexedDB work together

### New Feature: Time Snapping

We want to add a feature that automatically snaps time entries together when they're close to each other:

- [ ] **High priority**: When adding a new time entry, if it starts within 6 minutes after the previous entry ended, automatically set its start time to match the previous entry's end time
- [ ] **Medium priority**: Add a setting to adjust this time-snapping interval (default: 6 minutes)
- [ ] **Medium priority**: Make the time-snapping settings persist between sessions
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
