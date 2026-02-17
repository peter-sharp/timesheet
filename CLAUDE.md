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

Ensure all tests pass or document any known failures with explanations.

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

1. **Unit Tests** (test-runner-cli.js): Tests database operations, rollover logic, and core utilities
2. **Integration Tests** (if applicable): Test component interactions
3. **E2E Tests** (playwright): Test full user workflows in browser

Focus on running unit tests after each change, as they're fastest and catch most issues.

## Important Notes

- Never skip these chores even for "small" changes
- If a chore doesn't apply (e.g., no docs to update), note it in commit message
- When in doubt, over-document rather than under-document
- Keep TODO.md current - it's a living document
- Service worker caching issues are common; always verify version bumps work
