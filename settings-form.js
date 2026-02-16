import { ContextConsumer } from './utils/Context.js';

customElements.define('settings-form', class extends HTMLElement {
    connectedCallback() {
        this.stateConsumer = new ContextConsumer(this, 'state');
        this.render();

        // Handle form submission
        this.addEventListener('submit', (ev) => {
            ev.preventDefault();
            const form = ev.target;

            if (form.id === 'settings') {
                const formData = this.getFormData(form);

                // Convert focusInterval to number
                if (formData.focusInterval !== undefined) {
                    formData.focusInterval = parseFloat(formData.focusInterval);
                }

                // Convert timeSnapThreshold to number
                if (formData.timeSnapThreshold !== undefined) {
                    formData.timeSnapThreshold = parseInt(formData.timeSnapThreshold, 10);
                }

                this.dispatchEvent(new CustomEvent('updateState', {
                    bubbles: true,
                    detail: { type: 'updateSettings', data: formData }
                }));
            }
        });
    }

    getFormData(form) {
        const data = {};
        for (const element of form.elements) {
            if (!(element instanceof HTMLButtonElement) && element.name) {
                data[element.name] = element.value;
            }
        }
        return data;
    }

    setFormData(form, data) {
        for (const element of form.elements) {
            if (!(element instanceof HTMLButtonElement) && element.name) {
                element.value = data[element.name] === undefined ? '' : data[element.name];
            }
        }
    }

    render() {
        this.innerHTML = `
            <form class="stack" id="settings">
                <p>
                    <label for="settings_color">Color</label>
                    <input id="settings_color" type="color" name="color" />
                </p>
                <p>
                    <label for="settings_focus_interval">Focus Interval (hours)</label>
                    <input
                        id="settings_focus_interval"
                        type="number"
                        name="focusInterval"
                        step="0.01"
                        min="0"
                    />
                </p>
                <p>
                    <label for="settings_time_snap_threshold">Time Snap Threshold (minutes)</label>
                    <input
                        id="settings_time_snap_threshold"
                        type="number"
                        name="timeSnapThreshold"
                        min="0"
                        step="1"
                    />
                </p>
                <button type="submit">Save</button>
            </form>
        `;

        // Update form when settings change
        this.stateConsumer.subscribe((state) => {
            if (state?.settings) {
                const form = this.querySelector('#settings');
                if (form) {
                    this.setFormData(form, state.settings);
                }
            }
        });
    }
});
