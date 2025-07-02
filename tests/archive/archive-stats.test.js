// archive-stats tests
TestRunner.test('archive-stats updates charts based on archiveEntries signal', async () => {
  const signal = window.appContext.archiveEntries;
  const originalValue = signal.value;
  try {
    // Prepare test entries for today
    const today = new Date();
    const entry = {
      id: 101,
      task: 'Test',
      start: today,
      end: new Date(today.getTime() + 2 * 3600000) // 2 hours later
    };
    // Set signal value
    signal.value = [entry];

    // Wait for component to render
    await new Promise(resolve => setTimeout(resolve, 50));

    const component = document.querySelector('archive-stats');
    const chart = component.querySelector('graph-chart');
    // Ensure data exists
    TestRunner.assert(chart.data && chart.data.length > 0, 'Chart should have data points');
    // Find today's data point
    const todayData = chart.data.find(d => d.x === today.getDate());
    TestRunner.assert(todayData, 'Data point for today should exist');
    // Value should be > 0 (hours)
    TestRunner.assert(todayData.y > 0, 'Data point y value should be > 0');
  } finally {
    // Restore original signal
    signal.value = originalValue;
  }
});
