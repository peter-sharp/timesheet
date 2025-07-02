// Simple vanilla JS test framework
const TestRunner = {
  tests: [],
  results: { passed: 0, failed: 0, total: 0 },

  test(name, fn) {
    TestRunner.tests.push({ name, fn });
  },

  async runAll() {
    // Initialize results and UI
    TestRunner.results = { passed: 0, failed: 0, total: 0 };
    const resultsList = document.getElementById('test-results');
    const progressEl = document.getElementById('test-progress');
    resultsList.innerHTML = '';
    progressEl.textContent = `0/${TestRunner.tests.length} tests completed`;

    // Run each test with progress updates
    for (let i = 0; i < TestRunner.tests.length; i++) {
      const { name, fn } = TestRunner.tests[i];
      // Show current test being executed
      progressEl.textContent = `Running ${i+1}/${TestRunner.tests.length}: ${name}`;
      try {
        // Execute test with timeout
        await Promise.race([
          (async () => { await fn(); })(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test timed out')), 10000)
          )
        ]);
        TestRunner.results.passed++;
        resultsList.innerHTML += `<li class="test-pass">✓ ${name}</li>`;
      } catch (error) {
        TestRunner.results.failed++;
        resultsList.innerHTML += `<li class="test-fail">✗ ${name}: ${error.message}</li>`;
        console.error(`Test failed: ${name}`, error);
      }
      TestRunner.results.total++;
      // Update progress
      progressEl.textContent = `${TestRunner.results.total}/${TestRunner.tests.length} tests completed`;
    }

    // Final summary
    document.getElementById('test-summary').textContent =
      `${TestRunner.results.passed}/${TestRunner.results.total} tests passed`;
  },

  assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  },

  assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
};

window.TestRunner = TestRunner;
