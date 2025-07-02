// indexeddb-integration tests
import store from '../../timesheetStore.js';

TestRunner.test('IndexedDB adapter read returns archive with tasks and entries', async () => {
+  console.log('Starting IndexedDB integration test');
+  // Wait two frames and yield to event loop to ensure DB is ready
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 0));
+  // Wait one frame to ensure IndexedDB is initialized and custom elements are upgraded
+  await new Promise(r => requestAnimationFrame(r));
  const pageSize = 5;
  const page = 0;
  const data = await store.read({
    archiveBrowserTaskPage: page,
    archiveBrowserTaskPageSize: pageSize
  });
  TestRunner.assert(data.archive, 'Archive property should exist');
  TestRunner.assert(Array.isArray(data.archive.tasks), 'archive.tasks should be an array');
  TestRunner.assert(Array.isArray(data.archive.entries), 'archive.entries should be an array');
  TestRunner.assert(
    data.archive.tasks.length <= pageSize,
    `archive.tasks length (${data.archive.tasks.length}) should not exceed pageSize (${pageSize})`
  );
});
