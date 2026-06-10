import { ContextRequestEvent } from './utils/Context.js';

customElements.define('settings-form', class extends HTMLElement {
    #settings;
    #unsubscribe;

    connectedCallback() {
        this.render();

        // Request context state
        this.dispatchEvent(
            new ContextRequestEvent(
                'state',
                (state, unsubscribe) => {
                    this.#settings = state.settings;
                    this.#unsubscribe = unsubscribe;

                    // Subscribe to settings changes
                    this.#settings.effect(() => {
                        this.updateFormValues();
                    });

                    // Initial render
                    this.updateFormValues();
                },
                true
            )
        );

        // Add input mask to focus interval field
        this.addEventListener('input', (ev) => {
            if (ev.target.id === 'settings_focus_interval') {
                this.applyDurationMask(ev.target);
            }
        });

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

                // Convert goal fields to numbers
                for (const key of ['weeklyHoursGoal', 'monthlyHoursGoal', 'weeklyTasksGoal', 'monthlyTasksGoal']) {
                    if (formData[key] !== undefined && formData[key] !== '') {
                        formData[key] = parseInt(formData[key], 10) || 0;
                    }
                }

                // Convert gap goal fields to numbers (allow decimals)
                for (const key of ['dailyGapGoal', 'monthlyGapGoal']) {
                    if (formData[key] !== undefined && formData[key] !== '') {
                        formData[key] = parseFloat(formData[key]) || 0;
                    }
                }

                // workdays is already an array of numbers from getFormData

                this.dispatchEvent(new CustomEvent('updateState', {
                    bubbles: true,
                    detail: { type: 'updateSettings', ...formData }
                }));
            }
        });
    }

    disconnectedCallback() {
        if (this.#unsubscribe) {
            this.#unsubscribe();
        }
    }

    updateFormValues() {
        const form = this.querySelector('#settings');
        if (form && this.#settings) {
            this.setFormData(form, this.#settings.value);
        }
    }

    // Apply input mask for hh:mm format
    applyDurationMask(input) {
        let value = input.value.replace(/[^0-9]/g, ''); // Remove non-digits

        if (value.length === 0) {
            input.value = '';
            return;
        }

        // Auto-format as user types
        if (value.length <= 2) {
            // Just hours (0-99)
            input.value = value;
        } else if (value.length === 3) {
            // h:mm format
            const hours = value.substring(0, 1);
            const minutes = value.substring(1, 3);
            input.value = `${hours}:${minutes}`;
        } else {
            // hh:mm format (or more)
            const hours = value.substring(0, value.length - 2);
            let minutes = value.substring(value.length - 2);

            // Clamp minutes to 59
            if (parseInt(minutes, 10) > 59) {
                minutes = '59';
            }

            input.value = `${hours}:${minutes}`;
        }
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
        const checkboxGroups = {};
        for (const element of form.elements) {
            if (element instanceof HTMLButtonElement || !element.name) continue;
            if (element.type === 'checkbox') {
                if (!checkboxGroups[element.name]) checkboxGroups[element.name] = [];
                if (element.checked) checkboxGroups[element.name].push(Number(element.value));
            } else {
                data[element.name] = element.value;
            }
        }
        for (const [name, values] of Object.entries(checkboxGroups)) {
            data[name] = values;
        }
        return data;
    }

    setFormData(form, data) {
        for (const element of form.elements) {
            if (element instanceof HTMLButtonElement || !element.name) continue;
            if (element.name === 'focusInterval') {
                element.value = data[element.name] !== undefined ? this.hoursToDuration(data[element.name]) : '';
            } else if (element.type === 'checkbox') {
                const arr = Array.isArray(data[element.name]) ? data[element.name] : [];
                element.checked = arr.includes(Number(element.value));
            } else {
                element.value = data[element.name] === undefined ? '' : data[element.name];
            }
        }
    }

    render() {
        this.innerHTML = `
            <style>
                .workdays-row { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.5rem; }
                .day-toggle { position: relative; }
                .day-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
                .day-toggle span {
                    display: inline-block; width: 2rem; height: 2rem; line-height: 2rem;
                    text-align: center; border: 1px solid currentColor; border-radius: 4px;
                    cursor: pointer; user-select: none; font-weight: bold; font-size: 0.85rem;
                    opacity: 0.35;
                }
                .day-toggle input:checked + span {
                    opacity: 1;
                    background: var(--color-accent, currentColor);
                    color: var(--color-bg, white);
                }
                .day-toggle input:focus-visible + span { outline: 2px solid currentColor; outline-offset: 2px; }
            </style>
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
                <fieldset>
                    <legend>Workdays</legend>
                    <div class="workdays-row">
                        <label class="day-toggle"><input type="checkbox" name="workdays" value="1" /><span>M</span></label>
                        <label class="day-toggle"><input type="checkbox" name="workdays" value="2" /><span>T</span></label>
                        <label class="day-toggle"><input type="checkbox" name="workdays" value="3" /><span>W</span></label>
                        <label class="day-toggle"><input type="checkbox" name="workdays" value="4" /><span>T</span></label>
                        <label class="day-toggle"><input type="checkbox" name="workdays" value="5" /><span>F</span></label>
                        <label class="day-toggle"><input type="checkbox" name="workdays" value="6" /><span>S</span></label>
                        <label class="day-toggle"><input type="checkbox" name="workdays" value="0" /><span>S</span></label>
                    </div>
                </fieldset>
                <fieldset>
                    <legend>Goals</legend>
                    <p>
                        <label for="settings_weekly_hours_goal">Weekly Hours Goal</label>
                        <input id="settings_weekly_hours_goal" type="number" name="weeklyHoursGoal" min="0" step="1" />
                    </p>
                    <p>
                        <label for="settings_monthly_hours_goal">Monthly Hours Goal</label>
                        <input id="settings_monthly_hours_goal" type="number" name="monthlyHoursGoal" min="0" step="1" />
                    </p>
                    <p>
                        <label for="settings_weekly_tasks_goal">Weekly Tasks Goal</label>
                        <input id="settings_weekly_tasks_goal" type="number" name="weeklyTasksGoal" min="0" step="1" />
                    </p>
                    <p>
                        <label for="settings_monthly_tasks_goal">Monthly Tasks Goal</label>
                        <input id="settings_monthly_tasks_goal" type="number" name="monthlyTasksGoal" min="0" step="1" />
                    </p>
                    <p>
                        <label for="settings_daily_gap_goal">Daily Gap Goal (hours)</label>
                        <input id="settings_daily_gap_goal" type="number" name="dailyGapGoal" min="0" step="0.5" />
                    </p>
                    <p>
                        <label for="settings_monthly_gap_goal">Monthly Gap Goal (hours)</label>
                        <input id="settings_monthly_gap_goal" type="number" name="monthlyGapGoal" min="0" step="1" />
                    </p>
                </fieldset>
                <button type="submit">Save</button>
            </form>
        `;
    }
});
