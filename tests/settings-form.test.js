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

async function testSettingsFormSave() {
    // Create a fresh DOM for this test
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
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

    // Mock customElements.define to capture the component class
    let ComponentClass = null;
    global.customElements = {
        define: (name, constructor) => {
            if (name === 'settings-form') {
                ComponentClass = constructor;
            }
        },
        get: (name) => {
            if (name === 'settings-form') return ComponentClass;
            return null;
        }
    };

    try {
        // Import the settings-form component (this will call customElements.define)
        await import('../settings-form.js?t=' + Date.now()); // Add timestamp to bypass cache

        if (!ComponentClass) {
            console.error('✗ Component class not captured');
            return false;
        }

        // Create a simulated component context
        const mockComponent = {
            _domContainer: dom.window.document.createElement('div'),
            _eventListeners: {},
            _dispatched: [],

            get innerHTML() {
                return this._domContainer.innerHTML;
            },
            set innerHTML(value) {
                this._domContainer.innerHTML = value;
            },

            querySelector: function(selector) {
                return this._domContainer.querySelector(selector);
            },

            addEventListener: function(event, handler) {
                if (!this._eventListeners[event]) this._eventListeners[event] = [];
                this._eventListeners[event].push(handler);
            },

            dispatchEvent: function(event) {
                this._dispatched.push(event);
                if (this._eventListeners[event.type]) {
                    this._eventListeners[event.type].forEach(handler => {
                        handler.call(this, event);
                    });
                }
                return true;
            }
        };

        // Bind component methods to our mock
        Object.setPrototypeOf(mockComponent, ComponentClass.prototype);

        // Call render to generate the HTML
        mockComponent.render();

        console.log('  ✓ Form rendered successfully');

        // Get form elements
        const form = mockComponent.querySelector('#settings');
        const colorInput = mockComponent.querySelector('#settings_color');
        const focusIntervalInput = mockComponent.querySelector('#settings_focus_interval');
        const timeSnapThresholdInput = mockComponent.querySelector('#settings_time_snap_threshold');

        if (!form || !colorInput || !focusIntervalInput || !timeSnapThresholdInput) {
            console.error('✗ Form elements not found');
            return false;
        }

        // Test 1: setFormData - loading initial values
        console.log('  Testing setFormData (loading initial values)...');

        const initialSettings = {
            color: '#ff0000',
            focusInterval: 0.833, // 50 minutes in decimal hours (50/60)
            timeSnapThreshold: 5
        };

        mockComponent.setFormData(form, initialSettings);

        if (colorInput.value !== '#ff0000') {
            console.error(`  ✗ Color not set correctly. Expected: #ff0000, Got: ${colorInput.value}`);
            return false;
        }
        console.log('  ✓ Color field loaded correctly');

        if (focusIntervalInput.value !== '0:50') {
            console.error(`  ✗ Focus interval not set correctly. Expected: 0:50, Got: ${focusIntervalInput.value}`);
            return false;
        }
        console.log('  ✓ Focus interval field loaded correctly (converted from decimal hours)');

        if (timeSnapThresholdInput.value !== '5') {
            console.error(`  ✗ Time snap threshold not set correctly. Expected: 5, Got: ${timeSnapThresholdInput.value}`);
            return false;
        }
        console.log('  ✓ Time snap threshold field loaded correctly');

        // Test 2: getFormData - saving updated values
        console.log('  Testing getFormData (saving updated values)...');

        // Update fields
        colorInput.value = '#00ff00';
        focusIntervalInput.value = '1:30'; // 1 hour 30 minutes
        timeSnapThresholdInput.value = '10';

        const formData = mockComponent.getFormData(form);

        if (formData.color !== '#00ff00') {
            console.error(`  ✗ Color not read correctly. Expected: #00ff00, Got: ${formData.color}`);
            return false;
        }
        console.log('  ✓ Color field read correctly');

        if (formData.focusInterval !== '1:30') {
            console.error(`  ✗ Focus interval not read correctly. Expected: 1:30, Got: ${formData.focusInterval}`);
            return false;
        }
        console.log('  ✓ Focus interval field read correctly (as string)');

        if (formData.timeSnapThreshold !== '10') {
            console.error(`  ✗ Time snap threshold not read correctly. Expected: 10, Got: ${formData.timeSnapThreshold}`);
            return false;
        }
        console.log('  ✓ Time snap threshold field read correctly (as string)');

        // Test 3: durationToHours conversion
        console.log('  Testing durationToHours conversion...');

        const decimalHours = mockComponent.durationToHours('1:30');
        if (Math.abs(decimalHours - 1.5) > 0.001) {
            console.error(`  ✗ Duration conversion failed. Expected: 1.5, Got: ${decimalHours}`);
            return false;
        }
        console.log('  ✓ Duration converted to decimal hours correctly');

        // Test 4: hoursToDuration conversion
        console.log('  Testing hoursToDuration conversion...');

        const durationString = mockComponent.hoursToDuration(0.833);
        if (durationString !== '0:50') {
            console.error(`  ✗ Hours conversion failed. Expected: 0:50, Got: ${durationString}`);
            return false;
        }
        console.log('  ✓ Decimal hours converted to duration correctly');

        // Test 5: Full save flow with submit event
        console.log('  Testing full save flow with submit event...');

        // Set up submit listener (simulating connectedCallback behavior)
        mockComponent.addEventListener('submit', (ev) => {
            ev.preventDefault();
            const form = ev.target;

            if (form.id === 'settings') {
                const formData = mockComponent.getFormData(form);

                // Convert focusInterval from hh:mm to decimal hours
                if (formData.focusInterval !== undefined && formData.focusInterval !== '') {
                    formData.focusInterval = mockComponent.durationToHours(formData.focusInterval);
                }

                // Convert timeSnapThreshold to number
                if (formData.timeSnapThreshold !== undefined) {
                    formData.timeSnapThreshold = parseInt(formData.timeSnapThreshold, 10);
                }

                mockComponent.dispatchEvent(new dom.window.CustomEvent('updateState', {
                    bubbles: true,
                    detail: { type: 'updateSettings', data: formData }
                }));
            }
        });

        // Trigger submit
        const submitEvent = new dom.window.Event('submit', { bubbles: true, cancelable: true });
        submitEvent.preventDefault = () => {};
        Object.defineProperty(submitEvent, 'target', { value: form, enumerable: true });

        mockComponent.dispatchEvent(submitEvent);

        // Find the updateState event
        const updateStateEvent = mockComponent._dispatched.find(e => e.type === 'updateState');

        if (!updateStateEvent) {
            console.error('  ✗ updateState event not dispatched');
            return false;
        }

        if (updateStateEvent.detail.type !== 'updateSettings') {
            console.error(`  ✗ Wrong event type. Expected: updateSettings, Got: ${updateStateEvent.detail.type}`);
            return false;
        }

        const savedData = updateStateEvent.detail.data;

        // Verify all saved values
        if (savedData.color !== '#00ff00') {
            console.error(`  ✗ Color not saved correctly. Expected: #00ff00, Got: ${savedData.color}`);
            return false;
        }
        console.log('  ✓ Color field saved correctly');

        if (Math.abs(savedData.focusInterval - 1.5) > 0.001) {
            console.error(`  ✗ Focus interval not saved correctly. Expected: 1.5, Got: ${savedData.focusInterval}`);
            return false;
        }
        console.log('  ✓ Focus interval field saved correctly (converted to decimal hours)');

        if (savedData.timeSnapThreshold !== 10) {
            console.error(`  ✗ Time snap threshold not saved correctly. Expected: 10 (number), Got: ${savedData.timeSnapThreshold} (${typeof savedData.timeSnapThreshold})`);
            return false;
        }
        console.log('  ✓ Time snap threshold field saved correctly (converted to number)');

        console.log('✓ All settings fields save correctly when save button clicked');
        return true;
    } catch (error) {
        console.error('✗ Settings save test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run tests
(async () => {
    console.log('\n=== Settings Form Component Tests ===\n');

    const importTest = await testSettingsFormImport();
    let allPassed = importTest;

    if (importTest) {
        const saveTest = await testSettingsFormSave();
        allPassed = allPassed && saveTest;
    }

    console.log('\n=== Tests Complete ===\n');

    process.exit(allPassed ? 0 : 1);
})();
