# Timesheet Tests

This directory contains tests for the timesheet application.

## Test Types

### 1. Browser-Based Unit Tests (test-runner.js)

These tests run in a real browser environment with access to the DOM and IndexedDB.

**Files:**
- `test-runner.js` - Simple vanilla JS test framework
- `task-list.test.js` - Tests for task-list component
- `prev-tasks-history.test.js` - Tests for prev-tasks history functionality
- `index.html` - Test runner HTML page

**How to run:**
```bash
# Start a web server (choose one):
python3 -m http.server 8000
# or
npx http-server
# or
php -S localhost:8000

# Then open in browser:
http://localhost:8000/tests/index.html

# Click "Run Tests" button to execute all tests
```

### 2. E2E Tests (Playwright)

End-to-end tests that automate browser interactions.

**Files:**
- Located in `/e2e/*.spec.js`
- `e2e/prev-tasks-history.spec.js` - E2E tests for prev-tasks functionality

**How to run:**
```bash
# Install dependencies first
npm install
npx playwright install

# Run all e2e tests
npm test

# Run specific test file
npx playwright test e2e/prev-tasks-history.spec.js

# Run with UI
npm run test:headed
```

## Prev-Tasks History Tests

The prev-tasks history functionality ensures that the task autocomplete datalist only shows historical tasks (not from today) for better UX.

### What's Being Tested

1. **Exclusion of Today's Tasks**: Tasks modified today should NOT appear in prev-tasks
2. **Inclusion of Historical Tasks**: Tasks from yesterday and earlier SHOULD appear
3. **Limit Enforcement**: Maximum 500 tasks should be returned
4. **Deleted Task Filtering**: Deleted tasks should be excluded
5. **Chronological Ordering**: Tasks should be ordered newest-first

### Test Files

- **Browser tests**: `tests/prev-tasks-history.test.js`
- **E2E tests**: `e2e/prev-tasks-history.spec.js`
- **Implementation**: `timesheetDb.js` lines 372-401 (getRecentTasks function)

### Manual Testing

If you want to manually verify the functionality:

1. Open the app at `http://localhost:8000`
2. Add several tasks for today
3. Open DevTools → Application → IndexedDB → timesheet → tasks
4. Edit some tasks to set their `lastModified` date to yesterday
5. Reload the app
6. Click on the task input field and view autocomplete suggestions
7. Verify only historical tasks appear (not today's tasks)

## Test Framework

The browser-based tests use a custom lightweight test runner (`test-runner.js`) that provides:
- `TestRunner.test(name, fn)` - Register a test
- `TestRunner.assert(condition, message)` - Basic assertion
- `TestRunner.assertEquals(actual, expected, message)` - Equality assertion
- Async/await support
- 10-second timeout per test
- Visual pass/fail indicators

## Adding New Tests

To add a new test file:

1. Create `tests/your-test.test.js`
2. Import dependencies and components
3. Write tests using `TestRunner.test()`
4. Add import to `tests/index.html`:
   ```javascript
   import './your-test.test.js';
   ```
5. Reload `tests/index.html` and run tests
