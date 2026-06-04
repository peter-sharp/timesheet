import { ContextRequestEvent } from '../utils/Context.js';
import { effect } from '../utils/Signal.js';
import '../components/graph-chart.js';

const template = document.createElement('template');
template.innerHTML = /*html*/`
<div class="stack">
    <section>
        <h3 class="h5">Totals</h3>
        <table class="stats-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Hours</th>
                    <th>Tasks Completed</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <th>This Week</th>
                    <td><output name="weeklyHours">—</output></td>
                    <td><output name="weeklyTasks">—</output></td>
                </tr>
                <tr>
                    <th>This Month</th>
                    <td><output name="monthlyHours">—</output></td>
                    <td><output name="monthlyTasks">—</output></td>
                </tr>
            </tbody>
        </table>
    </section>

    <section>
        <h3 class="h5">Goals</h3>
        <dl class="stats-goals">
            <div>
                <dt>Weekly Hours</dt>
                <dd>
                    <output name="weeklyHoursText"></output>
                    <progress name="weeklyHoursBar" max="100" value="0"></progress>
                </dd>
            </div>
            <div>
                <dt>Monthly Hours</dt>
                <dd>
                    <output name="monthlyHoursText"></output>
                    <progress name="monthlyHoursBar" max="100" value="0"></progress>
                </dd>
            </div>
            <div>
                <dt>Weekly Tasks</dt>
                <dd>
                    <output name="weeklyTasksText"></output>
                    <progress name="weeklyTasksBar" max="100" value="0"></progress>
                </dd>
            </div>
            <div>
                <dt>Monthly Tasks</dt>
                <dd>
                    <output name="monthlyTasksText"></output>
                    <progress name="monthlyTasksBar" max="100" value="0"></progress>
                </dd>
            </div>
        </dl>
    </section>

    <section>
        <h3 class="h5">Daily Hours This Month</h3>
        <graph-chart
            width="600" height="200" padding="40"
            x-label="Day of Month" y-label="Hours"
            class="daily-hours-chart"
        ></graph-chart>
    </section>

    <section>
        <h3 class="h5">Completed Tasks This Month</h3>
        <graph-chart
            width="600" height="200" padding="40"
            x-label="Day of Month" y-label="Tasks"
            class="daily-tasks-chart"
        ></graph-chart>
    </section>
</div>`;

customElements.define('stats-page', class extends HTMLElement {
    #weeklyStats;
    #monthlyStats;
    #settings;
    #unsubscribeSignals;
    #unsubscribeState;

    connectedCallback() {
        this.append(template.content.cloneNode(true));

        this.dispatchEvent(
            new ContextRequestEvent('state', (state, unsubscribe) => {
                this.#weeklyStats  = state.weeklyStats;
                this.#monthlyStats = state.monthlyStats;
                this.#settings     = state.settings;
                this.#unsubscribeState = unsubscribe;

                this.#unsubscribeSignals = effect(
                    () => this.#render(),
                    this.#weeklyStats,
                    this.#monthlyStats,
                    this.#settings
                );
            }, true)
        );

        this._onHashChange = () => {
            if (window.location.hash === '#stats') {
                this.#loadStats();
            }
        };
        window.addEventListener('hashchange', this._onHashChange);

        if (window.location.hash === '#stats') {
            this.#loadStats();
        }
    }

    disconnectedCallback() {
        this.#unsubscribeSignals?.();
        this.#unsubscribeState?.();
        window.removeEventListener('hashchange', this._onHashChange);
    }

    #loadStats() {
        this.dispatchEvent(new CustomEvent('updateState', {
            bubbles: true,
            detail: { type: 'loadStats' }
        }));
    }

    #render() {
        const weekly   = this.#weeklyStats?.value  || {};
        const monthly  = this.#monthlyStats?.value || {};
        const settings = this.#settings?.value     || {};

        const {
            weeklyHoursGoal  = 40,
            monthlyHoursGoal = 160,
            weeklyTasksGoal  = 10,
            monthlyTasksGoal = 40
        } = settings;

        // Totals
        this.#out('weeklyHours',  weekly.hours  != null ? `${weekly.hours} h`   : '—');
        this.#out('weeklyTasks',  weekly.tasksCompleted  != null ? weekly.tasksCompleted  : '—');
        this.#out('monthlyHours', monthly.hours != null ? `${monthly.hours} h`  : '—');
        this.#out('monthlyTasks', monthly.tasksCompleted != null ? monthly.tasksCompleted : '—');

        // Goal progress
        this.#progress('weeklyHoursText',   'weeklyHoursBar',   weekly.hours,           weeklyHoursGoal,  'h');
        this.#progress('monthlyHoursText',  'monthlyHoursBar',  monthly.hours,          monthlyHoursGoal, 'h');
        this.#progress('weeklyTasksText',   'weeklyTasksBar',   weekly.tasksCompleted,  weeklyTasksGoal,  '');
        this.#progress('monthlyTasksText',  'monthlyTasksBar',  monthly.tasksCompleted, monthlyTasksGoal, '');

        // Charts
        const daysInMonth = monthly.daysInMonth || 30;
        const dailyHoursGoal  = Math.round((monthlyHoursGoal / daysInMonth) * 10) / 10;
        const dailyTasksGoal  = Math.round((monthlyTasksGoal / daysInMonth) * 10) / 10;

        const hoursChart = this.querySelector('.daily-hours-chart');
        const tasksChart = this.querySelector('.daily-tasks-chart');
        if (hoursChart) {
            hoursChart.setAttribute('goal', dailyHoursGoal);
            hoursChart.data = monthly.dailyHours || [];
        }
        if (tasksChart) {
            tasksChart.setAttribute('goal', dailyTasksGoal);
            tasksChart.data = monthly.dailyCompletions || [];
        }
    }

    #out(name, value) {
        const el = this.querySelector(`output[name="${name}"]`);
        if (el) el.value = value;
    }

    #progress(textName, barName, actual = 0, goal = 1, unit) {
        const a = actual ?? 0;
        const pct = goal > 0 ? Math.min(100, Math.round((a / goal) * 100)) : 0;
        this.#out(textName, `${a}${unit} / ${goal}${unit} goal (${pct}%)`);
        const bar = this.querySelector(`progress[name="${barName}"]`);
        if (bar) bar.value = pct;
    }
});
