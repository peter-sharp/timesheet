// @ts-check

/**
 * Clear all browser storage (IndexedDB, localStorage, sessionStorage)
 * Call this before each test for a clean slate.
 */
async function clearAllData(page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });
}

/**
 * Navigate to the app and wait for it to be ready.
 * Clears data first for a fresh state.
 */
async function loadApp(page) {
  await page.goto('/');
  await clearAllData(page);
  await page.goto('/');
  // Wait for custom elements to upgrade and render
  await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });
}

/**
 * Add a task via the task form on the tasks page.
 */
async function addTask(page, { raw, exid = '', client = '' } = {}) {
  await page.goto('/#tasks');
  await page.waitForSelector('task-list form[data-new-task]');
  await page.fill('task-list input[name="taskRaw"]', raw);
  if (exid || client) {
    await page.click('task-list details summary');
    if (exid) await page.fill('task-list input[name="exid"]', exid);
    if (client) await page.fill('task-list input[name="client"]', client);
  }
  await page.click('task-list button[type="submit"]');
  // Wait for the task to appear in the list
  await page.waitForTimeout(200);
}

/**
 * Get all visible task items from the task list.
 * Returns array of { exid, description, client }.
 */
async function getTaskItems(page) {
  return page.evaluate(() => {
    const items = document.querySelectorAll('[data-task-totals] li[data-exid]');
    return Array.from(items).map(li => ({
      exid: li.dataset.exid,
      description: li.querySelector('[data-description]')?.textContent?.trim() || '',
      client: li.querySelector('[data-client]')?.textContent?.trim() || '',
    }));
  });
}

/**
 * Add a time entry via the timeline new entry form.
 */
async function addEntry(page, { task, timeStart, timeEnd, annotation = '' }) {
  await page.goto('/#time-entries');
  await page.waitForSelector('time-sheet section[data-new="entry"]', { timeout: 10000 });

  const newSection = page.locator('time-sheet section[data-new="entry"]');
  await newSection.locator('input[name="task"]').fill(task);
  await newSection.locator('input[name="time_start"]').fill(timeStart);
  await newSection.locator('input[name="time_end"]').fill(timeEnd);
  await newSection.locator('input[name="annotation"]').fill(annotation || 'work');
  // Trigger focusout to submit — click body to blur all inputs
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  await page.waitForTimeout(500);
}

/**
 * Get all visible time entry items from the timeline.
 * Returns array of { id, task, timeStart, timeEnd }.
 */
async function getEntryItems(page) {
  return page.evaluate(() => {
    const sections = document.querySelectorAll('#time_entries section[data-id]');
    return Array.from(sections).map(section => ({
      id: section.dataset.id,
      task: section.querySelector('input[name="task"]')?.value || '',
      timeStart: section.querySelector('input[name="time_start"]')?.value || '',
      timeEnd: section.querySelector('input[name="time_end"]')?.value || '',
    }));
  });
}

module.exports = { clearAllData, loadApp, addTask, getTaskItems, addEntry, getEntryItems };
