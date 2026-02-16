#!/usr/bin/env node

/**
 * CLI Test Runner - Runs browser-based tests in a Node.js environment
 * Uses jsdom for DOM simulation and fake-indexeddb for IndexedDB
 */

import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up minimal DOM
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <body>
      <app-context></app-context>
      <task-list features="add"></task-list>
      <div id="test-results"></div>
      <div id="test-progress"></div>
      <div id="test-summary"></div>
      <button id="run-tests">Run Tests</button>
    </body>
  </html>
`, {
  url: 'http://localhost:8000/',
  pretendToBeVisual: true
});

const { window } = dom;

// Set up global environment
Object.defineProperties(global, {
  window: { value: window, writable: true, configurable: true },
  document: { value: window.document, writable: true, configurable: true },
  customElements: { value: window.customElements, writable: true, configurable: true },
  HTMLElement: { value: window.HTMLElement, writable: true, configurable: true },
  DocumentFragment: { value: window.DocumentFragment, writable: true, configurable: true },
  Element: { value: window.Element, writable: true, configurable: true },
  Event: { value: window.Event, writable: true, configurable: true },
  CustomEvent: { value: window.CustomEvent, writable: true, configurable: true },
  Node: { value: window.Node, writable: true, configurable: true },
  requestAnimationFrame: { value: (cb) => setTimeout(cb, 16), writable: true, configurable: true },
  requestIdleCallback: { value: (cb) => setTimeout(cb, 1), writable: true, configurable: true },
  indexedDB: { value: indexedDB, writable: true, configurable: true },
  IDBKeyRange: { value: IDBKeyRange, writable: true, configurable: true },
  localStorage: { value: window.localStorage, writable: true, configurable: true },
  sessionStorage: { value: window.sessionStorage, writable: true, configurable: true },
  Notification: { value: class Notification { static requestPermission() { return Promise.resolve('denied'); } }, writable: true, configurable: true }
});

console.log('🧪 Setting up test environment...\n');

async function runTests() {
  try {
    // Import test runner first
    await import('./test-runner.js');

    // Make TestRunner available globally
    const TestRunner = window.TestRunner;
    global.TestRunner = TestRunner;

    // Import app components (needed for tests)
    await import('../app-context.js');
    await import('../timesheetDb.js');

    // Import test files
    await import('./task-list.test.js');
    await import('./prev-tasks-history.test.js');
    await import('./rollover-timestamp.test.js');

    // Wait a bit for tests to register and async operations to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    if (!TestRunner || !TestRunner.tests) {
      console.error('❌ TestRunner not found or no tests registered.');
      process.exit(1);
    }

    console.log(`📋 Found ${TestRunner.tests.length} tests\n`);
    console.log('▶️  Running tests...\n');

    // Run tests with custom output for CLI
    const results = { passed: 0, failed: 0, total: 0 };

    for (const { name, fn } of TestRunner.tests) {
      try {
        await Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test timed out')), 10000)
          )
        ]);
        results.passed++;
        console.log(`✅ ${name}`);
      } catch (error) {
        results.failed++;
        console.log(`❌ ${name}`);
        console.log(`   ${error.message}`);
        if (error.stack) {
          const stackLines = error.stack.split('\n').slice(1, 3);
          stackLines.forEach(line => console.log(`   ${line.trim()}`));
        }
        console.log('');
      }
      results.total++;
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 Test Results: ${results.passed}/${results.total} passed\n`);

    if (results.failed > 0) {
      console.log(`❌ ${results.failed} test(s) failed`);
      process.exit(1);
    } else {
      console.log('✅ All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error setting up tests:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
