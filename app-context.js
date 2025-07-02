import {ContextProvider} from './utils/Context.js';
import signal from './utils/Signal.js';
import { totalPagesSignal } from './timesheetStore.js';

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
    archiveTasks = signal([])
    archiveEntries = signal([])
    archiveOpen = signal(false)
    archiveBrowserTaskPage = signal(0)
    archiveBrowserTaskPageSize = signal(20)
    totalPages = totalPagesSignal // Use the totalPages signal from timesheetStore
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
        archiveTasks: this.archiveTasks,
        archiveEntries: this.archiveEntries,
        archiveOpen: this.archiveOpen,
        archiveBrowserTaskPage: this.archiveBrowserTaskPage,
        archiveBrowserTaskPageSize: this.archiveBrowserTaskPageSize,
        stats: this.stats,
        // FIXME: totalPages needs to be named better
        totalPages: this.totalPages // Provide totalPages in the state
    });
    updateProvider = new ContextProvider(this, 'state-update', ({...state}) => {
        this.stateProvider.value = {...state};
    });
    connectedCallback() {
        this.style.display = 'contents';
    }

    update({newEntry, entries, tasks, clients, settings, durationTotal, durationTotalGaps, currentTask, archive, archiveOpen, stats, archiveBrowserTaskPage, archiveBrowserTaskPageSize, totalPages, timeSnapThreshold}) {
        this.settings.value = {...settings}
        this.newEntry.value = {...newEntry}
        this.entries.value = [...entries]
        this.tasks.value = [...tasks]
        this.clients.value = [...clients]
        this.durationTotal.value = durationTotal
        this.durationTotalGaps.value = durationTotalGaps
        this.currentTask.value = currentTask
        this.archiveTasks.value = [...archive.tasks]
        this.archiveEntries.value = [...archive.entries]
        this.archiveOpen.value = archiveOpen
        this.archiveBrowserTaskPage.value = archiveBrowserTaskPage
        this.archiveBrowserTaskPageSize.value = archiveBrowserTaskPageSize
        this.stats.value = stats || {};
        this.totalPages.value = totalPages // Update totalPages value
        // Update timeSnapThreshold if provided, otherwise keep current value
        if (timeSnapThreshold !== undefined) {
            this.timeSnapThreshold.value = timeSnapThreshold;
        }
    }
});
