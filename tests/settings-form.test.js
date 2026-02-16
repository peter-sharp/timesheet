/**
 * Test for settings-form component
 * Tests that the component properly imports and uses Context API
 */

import { JSDOM } from 'jsdom';

async function testSettingsFormImport() {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        runScripts: 'outside-only'
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.CustomEvent = dom.window.CustomEvent;
    global.customElements = dom.window.customElements;

    try {
        // This should fail with the bug: "The requested module './utils/Context.js' does not provide an export named 'ContextConsumer'"
        await import('../settings-form.js');
        console.log('✓ settings-form.js imported successfully');
        return true;
    } catch (error) {
        console.error('✗ settings-form.js import failed:', error.message);
        if (error.message.includes('ContextConsumer')) {
            console.error('  Bug confirmed: ContextConsumer is not exported from Context.js');
            console.error('  Expected exports: ContextRequestEvent, ContextProvider');
        }
        return false;
    }
}

async function testSettingsFormRendering() {
    const dom = new JSDOM('<!DOCTYPE html><html><body><settings-form></settings-form></body></html>', {
        url: 'http://localhost',
        runScripts: 'outside-only'
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.CustomEvent = dom.window.CustomEvent;
    global.customElements = dom.window.customElements;

    try {
        await import('../settings-form.js');

        const settingsForm = dom.window.document.querySelector('settings-form');

        // Check if component is defined
        if (!dom.window.customElements.get('settings-form')) {
            console.error('✗ settings-form custom element not registered');
            return false;
        }

        console.log('✓ settings-form component renders without errors');
        return true;
    } catch (error) {
        console.error('✗ settings-form rendering failed:', error.message);
        return false;
    }
}

// Run tests
(async () => {
    console.log('\n=== Settings Form Component Tests ===\n');

    const importTest = await testSettingsFormImport();

    if (importTest) {
        await testSettingsFormRendering();
    }

    console.log('\n=== Tests Complete ===\n');

    process.exit(importTest ? 0 : 1);
})();
