// timesheet-archive tests
TestRunner.test('timesheet-archive renders entries from signals', async () => {
  const signal = window.appContext.archiveEntries;
  const originalValue = signal.value;
  try {
    // Prepare test entry
    const now = new Date();
    const testEntry = {
      id: 42,
      task: 'Task 42',
      annotation: 'Note 42',
      start: now,
      end: new Date(now.getTime() + 3600000),
      synced: true
    };
    // Update signal
    signal.value = [testEntry];
    // Wait for component to render
    await new Promise(resolve => setTimeout(resolve, 500));
    const component = document.querySelector('timesheet-archive');
    const row = component.querySelector('tr[data-id="42"]');
    TestRunner.assert(row, 'Entry row should be rendered');
    TestRunner.assertEquals(
      row.querySelector('[data-field="task"]').innerText,
      'Task 42',
      'Task field should render correct text'
    );
    TestRunner.assertEquals(
      row.querySelector('[data-field="annotation"]').innerText,
      'Note 42',
      'Annotation field should render correct text'
    );
    const syncedText = row.querySelector('[data-field="synced"]').innerText.trim();
    TestRunner.assertEquals(syncedText, 'yes', 'Synced field should show "yes"');
  } finally {
    // Restore original signal value
    signal.value = originalValue;
  }
});
