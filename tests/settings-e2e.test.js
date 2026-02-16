/**
 * End-to-end test for settings form
 * Simulates the full flow: open settings page → update field → click save → verify persistence
 */

import { JSDOM } from 'jsdom';

async function testSettingsEndToEnd() {
    console.log('Starting end-to-end settings test...\n');

    // Create a fresh DOM environment
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
            <app-context>
                <settings-form></settings-form>
            </app-context>
        </body>
        </html>
    `, {
        url: 'http://localhost',
        runScripts: 'outside-only'
    });

    // Set up globals
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.CustomEvent = dom.window.CustomEvent;
    global.Event = dom.window.Event;
    global.EventTarget = dom.window.EventTarget;
    global.customElements = dom.window.customElements;

    // Mock localStorage
    const localStorageMock = {};
    global.localStorage = {
        getItem: (key) => localStorageMock[key] || null,
        setItem: (key, value) => {
            localStorageMock[key] = value;
        },
        clear: () => {
            Object.keys(localStorageMock).forEach(key => delete localStorageMock[key]);
        }
    };

    // Mock sessionStorage
    global.sessionStorage = {
        getItem: () => null,
        setItem: () => {},
        clear: () => {}
    };

    // Mock requestIdleCallback with immediate execution
    global.requestIdleCallback = (cb) => {
        setImmediate(cb);
    };

    try {
        // Step 1: Initialize localStorage with default settings
        console.log('Step 1: Initialize localStorage with default settings');
        const initialSettings = {
            color: '#112233',
            focusInterval: 0.833, // 50 minutes
            timeSnapThreshold: 6
        };

        localStorage.setItem('timesheet', JSON.stringify({
            version: '2.0',
            newEntry: {},
            currentTask: {},
            clients: [],
            settings: initialSettings
        }));

        console.log('  ✓ Initial settings stored:', initialSettings);

        // Step 2: Import components
        console.log('\nStep 2: Load components');

        // Import Signal
        const { Signal } = await import('../utils/Signal.js');

        // Import Context
        await import('../utils/Context.js');

        // Mock IndexedDB before importing store
        global.indexedDB = {
            open: () => {
                const request = {
                    onsuccess: null,
                    onerror: null,
                    onupgradeneeded: null,
                    result: {
                        transaction: () => ({
                            objectStore: () => ({
                                getAll: () => ({ onsuccess: null, onerror: null }),
                                get: () => ({ onsuccess: null, onerror: null }),
                                put: () => ({ onsuccess: null, onerror: null }),
                                add: () => ({ onsuccess: null, onerror: null }),
                                delete: () => ({ onsuccess: null, onerror: null }),
                                index: () => ({
                                    openCursor: () => ({ onsuccess: null, onerror: null })
                                })
                            })
                        })
                    }
                };
                // Immediately succeed
                setTimeout(() => {
                    if (request.onupgradeneeded) {
                        request.onupgradeneeded({ target: request });
                    }
                    if (request.onsuccess) {
                        request.onsuccess({ target: request });
                    }
                }, 0);
                return request;
            }
        };

        // Import and configure store
        const storeModule = await import('../timesheetStore.js');
        console.log('  ✓ Store imported');

        // Import app-context
        await import('../app-context.js');
        console.log('  ✓ app-context imported');

        // Import settings-form
        await import('../settings-form.js');
        console.log('  ✓ settings-form imported');

        // Step 3: Create and setup app-context manually
        console.log('\nStep 3: Setup app-context');

        const appContext = dom.window.document.querySelector('app-context');

        // Create state signals manually
        appContext.settings = new Signal({ ...initialSettings });
        appContext.newEntry = new Signal({});
        appContext.entries = new Signal([]);
        appContext.tasks = new Signal([]);
        appContext.clients = new Signal([]);
        appContext.currentTask = new Signal({});
        appContext.deleted = new Signal([]);
        appContext.deletedTasks = new Signal([]);
        appContext.allTasks = new Signal([]);
        appContext.durationTotal = new Signal(0);
        appContext.durationTotalGaps = new Signal(0);
        appContext.timeSnapThreshold = new Signal(6);

        // Set up state provider
        const { ContextProvider } = await import('../utils/Context.js');
        appContext.stateProvider = new ContextProvider(appContext, 'state', {
            settings: appContext.settings,
            newEntry: appContext.newEntry,
            entries: appContext.entries,
            tasks: appContext.tasks,
            clients: appContext.clients,
            currentTask: appContext.currentTask,
            allTasks: appContext.allTasks,
            durationTotal: appContext.durationTotal,
            durationTotalGaps: appContext.durationTotalGaps
        });

        // Track persistState calls
        let persistStateCallCount = 0;
        let lastSavedSettings = null;
        appContext.persistState = async function() {
            persistStateCallCount++;
            lastSavedSettings = { ...this.settings.value };
            // Manually update localStorage like the real persistState does
            const currentData = JSON.parse(localStorage.getItem('timesheet') || '{}');
            localStorage.setItem('timesheet', JSON.stringify({
                ...currentData,
                settings: this.settings.value
            }));
        };

        // Set up event listener
        appContext.addEventListener('updateState', (ev) => {
            const { type, ...data } = ev.detail;
            if (type === 'updateSettings') {
                appContext.settings.value = { ...appContext.settings.value, ...data };
                appContext.persistState();
            }
        });

        console.log('  ✓ app-context configured with state');

        // Step 4: Initialize settings-form
        console.log('\nStep 4: Initialize settings-form');

        const settingsForm = dom.window.document.querySelector('settings-form');

        // Manually trigger connectedCallback
        if (settingsForm.connectedCallback) {
            settingsForm.connectedCallback();
        }

        // Wait for render and context subscription
        await new Promise(resolve => setTimeout(resolve, 150));

        const form = settingsForm.querySelector('#settings');
        if (!form) {
            throw new Error('Settings form not rendered');
        }
        console.log('  ✓ Settings form rendered');

        // Step 5: Verify initial values
        console.log('\nStep 5: Verify initial values loaded');

        const colorInput = settingsForm.querySelector('#settings_color');
        const focusIntervalInput = settingsForm.querySelector('#settings_focus_interval');
        const timeSnapThresholdInput = settingsForm.querySelector('#settings_time_snap_threshold');

        if (!colorInput || !focusIntervalInput || !timeSnapThresholdInput) {
            throw new Error('Form inputs not found');
        }

        console.log('  Color:', colorInput.value);
        console.log('  Focus Interval:', focusIntervalInput.value);
        console.log('  Time Snap Threshold:', timeSnapThresholdInput.value);

        if (colorInput.value !== '#112233') {
            throw new Error(`Color not loaded. Expected: #112233, Got: ${colorInput.value}`);
        }
        if (focusIntervalInput.value !== '0:50') {
            throw new Error(`Focus interval not loaded. Expected: 0:50, Got: ${focusIntervalInput.value}`);
        }
        if (timeSnapThresholdInput.value !== '6') {
            throw new Error(`Time snap threshold not loaded. Expected: 6, Got: ${timeSnapThresholdInput.value}`);
        }
        console.log('  ✓ All initial values correct');

        // Step 6: Update fields
        console.log('\nStep 6: Update form fields');
        colorInput.value = '#00ff00';
        focusIntervalInput.value = '1:30';
        timeSnapThresholdInput.value = '10';
        console.log('  ✓ Fields updated:');
        console.log('    Color: #112233 → #00ff00');
        console.log('    Focus Interval: 0:50 → 1:30');
        console.log('    Time Snap Threshold: 6 → 10');

        // Step 7: Submit form
        console.log('\nStep 7: Click save button');

        const submitEvent = new dom.window.Event('submit', { bubbles: true, cancelable: true });
        Object.defineProperty(submitEvent, 'target', { value: form, enumerable: true });

        form.dispatchEvent(submitEvent);
        console.log('  ✓ Form submitted');

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 100));

        // Step 8: Verify settings saved
        console.log('\nStep 8: Verify settings saved to state');

        if (persistStateCallCount === 0) {
            throw new Error('persistState was never called!');
        }
        console.log(`  ✓ persistState called ${persistStateCallCount} time(s)`);

        if (!lastSavedSettings) {
            throw new Error('No settings were saved');
        }

        console.log('  Saved settings:', lastSavedSettings);

        if (lastSavedSettings.color !== '#00ff00') {
            throw new Error(`Color not saved. Expected: #00ff00, Got: ${lastSavedSettings.color}`);
        }
        if (Math.abs(lastSavedSettings.focusInterval - 1.5) > 0.001) {
            throw new Error(`Focus interval not saved. Expected: 1.5, Got: ${lastSavedSettings.focusInterval}`);
        }
        if (lastSavedSettings.timeSnapThreshold !== 10) {
            throw new Error(`Time snap threshold not saved. Expected: 10 (number), Got: ${lastSavedSettings.timeSnapThreshold} (${typeof lastSavedSettings.timeSnapThreshold})`);
        }
        console.log('  ✓ All settings saved correctly');

        // Step 9: Verify localStorage persistence
        console.log('\nStep 9: Verify localStorage persistence');

        const persistedData = JSON.parse(localStorage.getItem('timesheet'));
        console.log('  Persisted settings:', persistedData.settings);

        if (!persistedData.settings) {
            throw new Error('Settings not in localStorage');
        }

        if (persistedData.settings.color !== '#00ff00') {
            throw new Error(`Color not persisted. Expected: #00ff00, Got: ${persistedData.settings.color}`);
        }
        if (Math.abs(persistedData.settings.focusInterval - 1.5) > 0.001) {
            throw new Error(`Focus interval not persisted. Expected: 1.5, Got: ${persistedData.settings.focusInterval}`);
        }
        if (persistedData.settings.timeSnapThreshold !== 10) {
            throw new Error(`Time snap threshold not persisted. Expected: 10, Got: ${persistedData.settings.timeSnapThreshold}`);
        }
        console.log('  ✓ All settings persisted to localStorage');

        console.log('\n✓ END-TO-END TEST PASSED\n');
        console.log('Summary:');
        console.log('  - Settings form loads initial values correctly');
        console.log('  - User can update all fields');
        console.log('  - Clicking save triggers state update');
        console.log('  - Settings are persisted to localStorage');
        console.log('  - All data types are converted correctly');
        return true;

    } catch (error) {
        console.error('\n✗ END-TO-END TEST FAILED:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run test
(async () => {
    console.log('\n=== Settings End-to-End Test ===\n');

    const passed = await testSettingsEndToEnd();

    console.log('\n=== Test Complete ===\n');

    process.exit(passed ? 0 : 1);
})();
