import {ContextRequestEvent} from './utils/Context.js';
import timeLoop from './utils/timeLoop.js';
const currentTaskTemplate = document.createElement("template");
currentTaskTemplate.innerHTML = /*html*/ `<output name="taskEXID"></output> <time-duration></time-duration>`;
class CurrentTask extends HTMLElement {
    #newEntry;
    #unsubscribeNewEntry;
    #loop;

    constructor() {
        super();
        this.appendChild(currentTaskTemplate.content.cloneNode(true));
    }

    #unsubscribe;

    connectedCallback() {
        this.dispatchEvent(new ContextRequestEvent('state', (state, unsubscribe) => {
            this.#newEntry = state.newEntry;
            this.#unsubscribeNewEntry = this.#newEntry.effect(this.update.bind(this))
            this.update();
            this.#unsubscribe = unsubscribe;
        }, true));

        this.#loop = timeLoop(1000, () => {
            this.update();
        })
    }

    disconnectedCallback() {
        this.#unsubscribe?.();
        this.#unsubscribeNewEntry?.();
        if(this.#loop) clearTimeout(this.#loop.timeout);
    }

    update() {

        if(this.#newEntry) this.render(this.#newEntry.value);
    }

    render(newEntry) {
        const taskEXID = this.querySelector('[name="taskEXID"]');
        taskEXID.value = newEntry.task || '';
        const duration = this.querySelector('time-duration');
        duration.hidden = newEntry.start == undefined;
        if (!duration.hidden) {
            duration.setAttribute("start", newEntry.start);
            duration.setAttribute("end", new Date());
        }

    }
}
window.customElements.define('current-task', CurrentTask);
