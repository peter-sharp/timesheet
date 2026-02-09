// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, seedFileHandle } = require('./helpers');

test.describe('File Sync Menu', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('popup menu opens when clicking ... in footer', async ({ page }) => {
    const details = page.locator('footer .popup-menu');
    const summary = details.locator('summary');
    await summary.click();
    await expect(details).toHaveAttribute('open', '');
  });

  test('Link todo.txt and Link done.txt buttons are visible', async ({ page }) => {
    const details = page.locator('footer .popup-menu');
    await details.locator('summary').click();
    await expect(page.locator('file-sync-menu [name="linkTodo"]')).toBeVisible();
    await expect(page.locator('file-sync-menu [name="linkDone"]')).toBeVisible();
  });

  test('shows linked file name and Unlink button after seeding fileHandles', async ({ page }) => {
    await seedFileHandle(page, 'todoFile', 'my-todo.txt');
    // Reload to pick up the seeded handle
    await page.reload();
    await page.waitForSelector('task-list form[data-new-task]', { timeout: 10000 });

    const details = page.locator('footer .popup-menu');
    await details.locator('summary').click();

    await expect(page.locator('file-sync-menu [data-todo-linked]')).toBeVisible();
    await expect(page.locator('file-sync-menu [data-todo-linked] [data-file-name]')).toHaveText('my-todo.txt');
    await expect(page.locator('file-sync-menu [name="unlinkTodo"]')).toBeVisible();
    await expect(page.locator('file-sync-menu [name="linkTodo"]')).toBeHidden();
  });

  test('shows unsupported message when API not available', async ({ page }) => {
    await page.evaluate(() => {
      delete window.showOpenFilePicker;
    });
    // Remove and re-add the element to trigger connectedCallback with API removed
    await page.evaluate(() => {
      const menu = document.querySelector('file-sync-menu');
      const parent = menu.parentElement;
      menu.remove();
      const fresh = document.createElement('file-sync-menu');
      parent.appendChild(fresh);
    });

    const details = page.locator('footer .popup-menu');
    await details.locator('summary').click();

    await expect(page.locator('file-sync-menu [data-unsupported]')).toBeVisible();
  });
});
