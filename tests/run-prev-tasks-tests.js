#!/usr/bin/env node

/**
 * Simplified test runner for prev-tasks-history tests only
 * Directly tests the getRecentTasks function without full DOM setup
 */

import 'fake-indexeddb/auto';
import TimesheetDB from '../timesheetDb.js';

// Mock localStorage for tests
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

console.log('🧪 Testing prev-tasks history functionality\n');

// Helper to create test dates
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// Helper to clear database
async function clearDatabase() {
  const db = await TimesheetDB();
  const allTasks = await db.getAllTasks();
  for (const task of allTasks) {
    await db.permanentlyDeleteTask(task.exid);
  }
}

// Test results tracking
const results = { passed: 0, failed: 0, total: 0 };

function test(name, fn) {
  return async () => {
    results.total++;
    try {
      await fn();
      results.passed++;
      console.log(`✅ ${name}`);
    } catch (error) {
      results.failed++;
      console.log(`❌ ${name}`);
      console.log(`   ${error.message}\n`);
    }
  };
}

// Run tests
(async () => {
  try {
    await clearDatabase();

    await test('getRecentTasks excludes tasks modified today', async () => {
      const db = await TimesheetDB();
      await clearDatabase();

      // Add tasks from different days
      await db.addTask({
        exid: 'TODAY1',
        description: 'Task from today',
        deleted: false
      });

      await db.addTask({
        exid: 'YEST1',
        description: 'Task from yesterday',
        lastModified: daysAgo(1),
        deleted: false
      });

      const recentTasks = await db.getRecentTasks(500);
      const exids = recentTasks.map(t => t.exid);

      if (!exids.includes('YEST1')) {
        throw new Error('Should include task from yesterday');
      }

      if (exids.includes('TODAY1')) {
        throw new Error('Should NOT include task from today');
      }
    })();

    await test('getRecentTasks respects limit parameter', async () => {
      const db = await TimesheetDB();
      await clearDatabase();

      // Create more tasks than the limit
      for (let i = 0; i < 10; i++) {
        await db.addTask({
          exid: `HIST${i}`,
          description: `Historical task ${i}`,
          lastModified: daysAgo(2 + i),
          deleted: false
        });
      }

      const recentTasks = await db.getRecentTasks(5);

      if (recentTasks.length !== 5) {
        throw new Error(`Expected 5 tasks, got ${recentTasks.length}`);
      }
    })();

    await test('getRecentTasks excludes deleted tasks', async () => {
      const db = await TimesheetDB();
      await clearDatabase();

      await db.addTask({
        exid: 'ACTIVE1',
        description: 'Active task',
        lastModified: daysAgo(2),
        deleted: false
      });

      await db.addTask({
        exid: 'DELETED1',
        description: 'Deleted task',
        lastModified: daysAgo(2),
        deleted: true
      });

      const recentTasks = await db.getRecentTasks(500);
      const exids = recentTasks.map(t => t.exid);

      if (!exids.includes('ACTIVE1')) {
        throw new Error('Should include active task');
      }

      if (exids.includes('DELETED1')) {
        throw new Error('Should NOT include deleted task');
      }
    })();

    await test('getRecentTasks returns tasks in reverse chronological order', async () => {
      const db = await TimesheetDB();
      await clearDatabase();

      await db.addTask({
        exid: 'OLD1',
        description: 'Oldest task',
        lastModified: daysAgo(3),
        deleted: false
      });

      await db.addTask({
        exid: 'MID1',
        description: 'Middle task',
        lastModified: daysAgo(2),
        deleted: false
      });

      await db.addTask({
        exid: 'RECENT1',
        description: 'Most recent task',
        lastModified: daysAgo(1),
        deleted: false
      });

      const recentTasks = await db.getRecentTasks(500);

      if (recentTasks[0].exid !== 'RECENT1') {
        throw new Error(`Most recent task should be first, got ${recentTasks[0].exid}`);
      }

      if (recentTasks[1].exid !== 'MID1') {
        throw new Error(`Middle task should be second, got ${recentTasks[1].exid}`);
      }

      if (recentTasks[2].exid !== 'OLD1') {
        throw new Error(`Oldest task should be last, got ${recentTasks[2].exid}`);
      }
    })();

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 Test Results: ${results.passed}/${results.total} passed\n`);

    if (results.failed > 0) {
      console.log(`❌ ${results.failed} test(s) failed`);
      process.exit(1);
    } else {
      console.log('✅ All prev-tasks-history tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error running tests:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
