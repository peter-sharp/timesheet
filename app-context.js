import {ContextProvider} from './utils/Context.js';
import signal from './utils/Signal.js';

customElements.define('app-context', class extends HTMLElement {
    settings = signal({})
    newEntry = signal({})
    entries = signal([])
    tasks = signal([])
    timeSnapThreshold = signal(6) // Default: 6 minutes for time-snapping feature
    clients = signal([])
    durationTotal = signal(0)
    durationTotalGaps = signal(0)
    currentTask = signal({})
    stats = signal({});

    stateProvider = new ContextProvider(this, 'state', {
        settings: this.settings,
        newEntry: this.newEntry,
        entries: this.entries,
        tasks: this.tasks,
        timeSnapThreshold: this.timeSnapThreshold,
        clients: this.clients,
        durationTotal: this.durationTotal,
        durationTotalGaps: this.durationTotalGaps,
        currentTask: this.currentTask,
        stats: this.stats
    });

    updateProvider = new ContextProvider(this, 'state-update', ({...state}) => {
        this.stateProvider.value = {...state};
    });

    connectedCallback() {
        this.style.display = 'contents';
    }

    update({newEntry, entries, tasks, clients, settings, durationTotal, durationTotalGaps, currentTask, stats, timeSnapThreshold}) {
        this.settings.value = {...settings}
        this.newEntry.value = {...newEntry}
        this.entries.value = [...entries]
        this.tasks.value = [...tasks]
        this.clients.value = [...clients]
        this.durationTotal.value = durationTotal
        this.durationTotalGaps.value = durationTotalGaps
        this.currentTask.value = currentTask
        this.stats.value = stats || {};

        // Update timeSnapThreshold if provided
        if (timeSnapThreshold !== undefined) {
            this.timeSnapThreshold.value = timeSnapThreshold;
        }
    }
});
