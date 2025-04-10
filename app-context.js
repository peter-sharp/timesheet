import {ContextProvider} from './utils/Context.js';
import signal from './utils/Signal.js';
customElements.define('app-context', class extends HTMLElement {
    settings = signal({})
    newEntry = signal({})
    entries = signal([])
    tasks = signal([])
    clients = signal([])
    durationTotal = signal(0)
    durationTotalGaps = signal(0)
    currentTask = signal({})
    archive = signal({ tasks: [], entries: [] })
    archiveOpen = signal(false)
    archiveBrowserTaskPage = signal(0)
    archiveBrowserTaskPageSize = signal(20)
    stateProvider = new ContextProvider(this, 'state', {
        settings: this.settings,
        newEntry: this.newEntry,
        entries: this.entries,
        tasks: this.tasks,
        clients: this.clients,
        durationTotal: this.durationTotal,
        durationTotalGaps: this.durationTotalGaps,
        currentTask: this.currentTask,
        archive: this.archive,
        archiveOpen: this.archiveOpen,
        archiveBrowserTaskPage: this.archiveBrowserTaskPage,
        archiveBrowserTaskPageSize: this.archiveBrowserTaskPageSize
    });
    updateProvider = new ContextProvider(this, 'state-update', ({...state}) => {
        this.stateProvider.value = {...state};
    });
    connectedCallback() {
        this.style.display = 'contents';
    }

    update({newEntry, entries, tasks, clients, settings, durationTotal, durationTotalGaps, currentTask, archive, archiveOpen, archiveBrowserTaskPage, archiveBrowserTaskPageSize}) {
        this.settings.value = {...settings}
        this.newEntry.value = {...newEntry}
        this.entries.value = [...entries]
        this.tasks.value = [...tasks]
        this.clients.value = [...clients]
        this.durationTotal.value = durationTotal
        this.durationTotalGaps.value = durationTotalGaps
        this.currentTask.value = currentTask
        this.archive.value = {...archive}
        this.archiveOpen.value = archiveOpen
        this.archiveBrowserTaskPage.value = archiveBrowserTaskPage
        this.archiveBrowserTaskPageSize.value = archiveBrowserTaskPageSize
    }
});