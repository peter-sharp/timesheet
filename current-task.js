import {ContextRequestEvent} from './utils/Context.js';
import timeLoop from './utils/timeLoop.js';
import calcDuration from './utils/calcDuration.js';
import { taskEstimate } from './utils/estimate.js';

const formatHours = (hours) => `${Math.abs(hours).toFixed(2)}h`;
const currentTaskTemplate = document.createElement("template");
currentTaskTemplate.innerHTML = /*html*/ `<output name="taskEXID"></output> <time-duration></time-duration> <output name="estimate" class="current-task__estimate"></output>`;
class CurrentTask extends HTMLElement {
    #newEntry;
    #tasksIndex = {};
    #tasks;
    #taskPastTotals;
    
    #unsubscribe = {};
    #loop;

    constructor() {
        super();
        this.appendChild(currentTaskTemplate.content.cloneNode(true));
    }


    connectedCallback() {
        this.dispatchEvent(new ContextRequestEvent('state', (state, unsubscribe) => {
            this.#newEntry = state.newEntry;
            this.#tasks = state.tasks;
            this.#taskPastTotals = state.taskPastTotals;
            this.#unsubscribe.newEntry = this.#newEntry.effect(this.update.bind(this));
            this.#unsubscribe.tasks = this.#tasks.effect(this.indexTasks.bind(this));
            this.#unsubscribe.taskPastTotals = this.#taskPastTotals?.effect(this.update.bind(this));
            this.update();
            this.#unsubscribe.context = unsubscribe;
        }, true));

        this.#loop = timeLoop(1000, () => {
            this.update();
        })
    }

    disconnectedCallback() {
        this.#unsubscribe.context?.();
        this.#unsubscribe.newEntry?.();
        this.#unsubscribe.tasks?.();
        this.#unsubscribe.taskPastTotals?.();
        if(this.#loop) clearTimeout(this.#loop.timeout);
    }

    getTaskById(exid) {
        return this.#tasksIndex[exid] || null;
    }

    indexTasks() {
        this.#tasksIndex = {};
        for (const task of this.#tasks.value) {
            this.#tasksIndex[task.exid] = task;
        }
    }

    update() {

        if(this.#newEntry) this.render(this.#newEntry.value);
    }

    render(newEntry) {
        const taskEXID = this.querySelector('[name="taskEXID"]');
        const task = this.getTaskById(newEntry.task);
        taskEXID.value = `${task ? `${task.description || task.exid} (${task.exid})` : newEntry.task || ''}`;
        const duration = this.querySelector('time-duration');
        duration.hidden = newEntry.start == undefined;
        if (!duration.hidden) {
            duration.setAttribute("start", newEntry.start);
            duration.setAttribute("end", new Date());
        }
        this.renderEstimate(task, newEntry);
    }

    // All-time task hours (previous days + today + running entry) vs the task's estimate
    renderEstimate(task, newEntry) {
        const output = this.querySelector('[name="estimate"]');
        output.hidden = !task;
        if (!task) {
            output.value = '';
            return;
        }
        const pastHours = this.#taskPastTotals?.value?.[task.exid] || 0;
        const runningHours = newEntry.start ? calcDuration({ start: new Date(newEntry.start), end: new Date() }) : 0;
        const totalHours = pastHours + (task.total || 0) + runningHours;
        const estimate = taskEstimate(task);
        const diff = totalHours - estimate;
        output.value = `${formatHours(totalHours)} / ${formatHours(estimate)} (${diff > 0 ? `+${formatHours(diff)} over` : `${formatHours(diff)} left`})`;
        output.toggleAttribute('data-over', diff > 0);

    }
}
window.customElements.define('current-task', CurrentTask);
