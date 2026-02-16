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

                // Convert focusInterval from hh:mm to decimal hours
                if (formData.focusInterval !== undefined && formData.focusInterval !== '') {
                    formData.focusInterval = this.durationToHours(formData.focusInterval);
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

    // Convert hh:mm or h:mm format to decimal hours
    durationToHours(duration) {
        const parts = duration.split(':');
        if (parts.length !== 2) return 0;
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        return hours + (minutes / 60);
    }

    // Convert decimal hours to hh:mm format
    hoursToDuration(hours) {
        if (hours === undefined || hours === null || hours === '') return '';
        const totalMinutes = Math.round(hours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
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
                // Special handling for focusInterval - convert decimal hours to hh:mm
                if (element.name === 'focusInterval') {
                    element.value = data[element.name] !== undefined ? this.hoursToDuration(data[element.name]) : '';
                } else {
                    element.value = data[element.name] === undefined ? '' : data[element.name];
                }
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
                    <label for="settings_focus_interval">Focus Interval (hh:mm)</label>
                    <input
                        id="settings_focus_interval"
                        type="text"
                        name="focusInterval"
                        pattern="[0-9]+:[0-5][0-9]"
                        placeholder="0:50"
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
