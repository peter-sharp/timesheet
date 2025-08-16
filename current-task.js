import {ContextRequestEvent} from './utils/Context.js';
import timeLoop from './utils/timeLoop.js';
const currentTaskTemplate = document.createElement("template");
currentTaskTemplate.innerHTML = /*html*/ `<output name="taskEXID"></output> <time-duration></time-duration>`;
class CurrentTask extends HTMLElement {
    #newEntry;
    #tasksIndex = {};
    #tasks;
    
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
            this.#unsubscribe.newEntry = this.#newEntry.effect(this.update.bind(this));
            this.#unsubscribe.tasks = this.#tasks.effect(this.indexTasks.bind(this));
            this.update();
            this.#unsubscribe = unsubscribe;
        }, true));

        this.#loop = timeLoop(1000, () => {
            this.update();
        })
    }

    disconnectedCallback() {
        this.#unsubscribe?.();
        this.#unsubscribe.newEntry?.();
        this.#unsubscribe.tasks?.();
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
        console.log("Indexed tasks", this.#tasksIndex);
    }

    update() {

        if(this.#newEntry) this.render(this.#newEntry.value);
    }

    render(newEntry) {
        const taskEXID = this.querySelector('[name="taskEXID"]');
        const task = this.getTaskById(newEntry.task);
        taskEXID.value = `${task ? `${task.description || task.exid} (${task.exid})` : newEntry.task}`;
        const duration = this.querySelector('time-duration');
        duration.hidden = newEntry.start == undefined;
        if (!duration.hidden) {
            duration.setAttribute("start", newEntry.start);
            duration.setAttribute("end", new Date());
        }

    }
}
window.customElements.define('current-task', CurrentTask);
