import {ContextProvider} from './utils/Context.js';
import signal from './utils/Signal.js';
customElements.define('app-context', class extends HTMLElement {
    newEntry = signal({})
    stateProvider = new ContextProvider(this, 'state', {newEntry: this.newEntry});
    updateProvider = new ContextProvider(this, 'state-update', ({...state}) => {
        this.stateProvider.value = {...state};
    });
    connectedCallback() {
        this.style.display = 'contents';
    }

    update({newEntry}) {
        this.newEntry.value = {...newEntry}
    }
});