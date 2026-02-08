import {ContextProvider} from './utils/Context.js';
import signal from './utils/Signal.js';
import store from './timesheetStore.js';
import calcDuration from './utils/calcDuration.js';
import reduce from './utils/reduce.js';
import reduceDuration from './utils/reduceDuration.js';
import extract from './utils/extract.js';
import first from './utils/first.js';
import last from './utils/last.js';

// Pure function: calculate gaps between entries
const calculateGaps = (entries) => entries.map((entry, i, arr) => {
    const prevEntry = arr[i - 1];
    const gap = prevEntry ? calcDuration({ start: prevEntry.end, end: entry.start }) : undefined;
    return { ...entry, gap };
});

// Pure function: sort entries by start time
const sortByStart = (entries) => [...entries].sort((a, b) => {
    const startA = new Date(a.start).getTime();
    const startB = new Date(b.start).getTime();
    return startA - startB;
});

// Pure function: find most recent entry by end time
const findMostRecentEntryByEndTime = (entries) => {
    if (!entries || entries.length === 0) return null;
    return entries.reduce((mostRecent, current) => {
        if (!mostRecent || !mostRecent.end) return current;
        if (!current.end) return mostRecent;
        return current.end > mostRecent.end ? current : mostRecent;
    }, null);
};

// Pure function: calculate task totals from entries
const calculateTaskTotals = (entries) => {
    const taskTotals = {};
    for (const entry of entries) {
        taskTotals[entry.task] = taskTotals[entry.task] || {
            task: entry.task,
            total: 0,
            mostRecentEntry: new Date(0, 0, 0),
            synced: true
        };
        taskTotals[entry.task].total += calcDuration(entry);
        if (!entry.synced) taskTotals[entry.task].synced = false;
        if (entry.start > taskTotals[entry.task].mostRecentEntry) {
            taskTotals[entry.task].mostRecentEntry = entry.start;
        }
    }
    return taskTotals;
};

// Pure function: merge tasks with totals
const mergeTasksWithTotals = (tasks, taskTotals) => {
    const oldTasks = tasks.map(x => typeof x === "string" ? { exid: x, description: x } : x);
    let mergedTasks = [];

    if (oldTasks.length >= Object.keys(taskTotals).length) {
        for (const task of oldTasks) {
            mergedTasks.push({ ...task, ...(taskTotals[task.exid] || { total: 0 }) });
        }
    } else {
        const tasksByExid = oldTasks.reduce((xs, x) => ({ ...xs, [x.exid]: x }), {});
        for (const [exid, stats] of Object.entries(taskTotals)) {
            mergedTasks.push({ ...(tasksByExid[exid] || {}), ...stats, exid });
        }
    }

    // Deduplicate by exid
    const tasksByExid = mergedTasks.reduce((xs, x) => ({ ...xs, [x.exid]: { ...(xs[x.exid] || {}), ...x } }), {});
    return Object.values(tasksByExid);
};

// Pure function: calculate duration totals
const calculateDurationTotals = (entries) => {
    const durationTotal = reduce(reduceDuration, 0, entries);
    const { start } = first(entries) || {};
    const { end } = last(entries) || {};
    const durationTotalNoGaps = calcDuration({ start, end });
    const durationTotalGaps = durationTotalNoGaps - durationTotal;
    return { durationTotal, durationTotalGaps };
};

customElements.define('app-context', class extends HTMLElement {
    settings = signal({})
    newEntry = signal({})
    entries = signal([])
    tasks = signal([])
    timeSnapThreshold = signal(6)
    clients = signal([])
    durationTotal = signal(0)
    durationTotalGaps = signal(0)
    currentTask = signal({})
    stats = signal({})
    deleted = signal([])
    deletedTasks = signal([])

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

    connectedCallback() {
        this.style.display = 'contents';

        // Listen for state update events from child components
        this.addEventListener('updateState', this.handleStateEvent.bind(this));
    }

    // Initialize state from storage
    async initialize(initialState) {
        const { settings, newEntry, entries, tasks, clients, currentTask, deleted, deletedTasks } = initialState;

        this.settings.value = { ...settings };
        this.newEntry.value = { ...newEntry };
        this.entries.value = [...entries];
        this.tasks.value = [...tasks];
        this.clients.value = [...clients];
        this.currentTask.value = currentTask || {};
        this.deleted.value = deleted || [];
        this.deletedTasks.value = deletedTasks || [];

        if (settings?.timeSnapThreshold !== undefined) {
            this.timeSnapThreshold.value = settings.timeSnapThreshold;
        }

        // Calculate initial totals
        this.recalculateTotals();
    }

    // Main event handler - processes all state change events
    handleStateEvent(ev) {
        const { type, ...data } = ev.detail;
        console.log('State event:', type, data);

        switch (type) {
            case 'newEntry':
                this.handleNewEntry(data);
                break;
            case 'clearNewEntry':
                this.handleClearNewEntry();
                break;
            case 'changedEntry':
                this.handleChangedEntry(data);
                break;
            case 'deleteEntry':
                this.handleDeleteEntry(data);
                break;
            case 'startTask':
                this.handleStartTask(data);
                break;
            case 'stopTask':
                this.handleStopTask(data);
                break;
            case 'addTask':
                this.handleAddTask(data);
                break;
            case 'deleteTask':
                this.handleDeleteTask(data);
                break;
            case 'taskComplete':
                this.handleTaskComplete(data);
                break;
            case 'taskSyncChanged':
                this.handleTaskSyncChanged(data);
                break;
            case 'updateSettings':
                this.handleUpdateSettings(data);
                break;
            case 'import':
                this.handleImport(data);
                break;
            default:
                console.log('Unhandled event type:', type);
        }

        // Persist state after each change
        this.persistState();
    }

    handleNewEntry({ task, annotation, start, end }) {
        this.newEntry.value = { task, annotation, start, end };
        const currentTask = this.tasks.value.find(x => x.exid === task);

        if (!currentTask) {
            const newTask = { exid: task, id: Date.now(), mostRecentEntry: new Date(), total: 0 };
            this.tasks.value = [...this.tasks.value, newTask];
            this.currentTask.value = newTask;
        } else {
            this.currentTask.value = currentTask;
        }

        this.tasks.value = this.tasks.value.map(x => ({
            ...x,
            timingState: x.exid === task ? "start" : "stop"
        }));
    }

    handleClearNewEntry() {
        this.newEntry.value = {};
        this.currentTask.value = {};
    }

    handleChangedEntry({ id, task, annotation, start, end }) {
        let entries = [...this.entries.value];

        if (id) {
            // Update existing entry
            entries = entries.map(x => x.id === id
                ? { ...x, task, annotation, start, end, lastModified: new Date() }
                : x
            );
        } else {
            // Create new entry with time snapping
            let snappedStart = start;
            if (entries.length > 0 && start) {
                const mostRecentEntry = findMostRecentEntryByEndTime(entries);
                if (mostRecentEntry && mostRecentEntry.end) {
                    const gapInMinutes = (start.getTime() - mostRecentEntry.end.getTime()) / (60 * 1000);
                    if (gapInMinutes > 0 && gapInMinutes <= this.settings.value.timeSnapThreshold) {
                        snappedStart = new Date(mostRecentEntry.end);
                    }
                }
            }

            entries = [...entries, {
                id: Date.now(),
                task,
                annotation,
                start: snappedStart,
                end,
                lastModified: new Date()
            }];

            this.newEntry.value = {};
            this.tasks.value = this.tasks.value.map(x =>
                x.exid === task ? { ...x, timingState: "stop" } : x
            );
        }

        // Sort and calculate gaps
        entries = sortByStart(entries);
        entries = calculateGaps(entries);

        // Ensure task exists
        if (!this.tasks.value.find(t => t.exid === task)) {
            this.tasks.value = [...this.tasks.value, { exid: task }];
        }

        this.entries.value = entries;
        this.recalculateTaskTotals();
        this.recalculateTotals();
    }

    handleDeleteEntry({ id }) {
        const entryToDelete = this.entries.value.find(x => x.id === id);
        if (entryToDelete) {
            this.deleted.value = [...this.deleted.value, entryToDelete];
        }
        this.entries.value = this.entries.value.filter(x => x.id !== id);
        this.recalculateTotals();
    }

    handleStartTask({ exid }) {
        // Stop current task if running
        if (this.newEntry.value.start) {
            this.entries.value = [...this.entries.value, {
                ...this.newEntry.value,
                id: Date.now(),
                end: new Date(),
                lastModified: new Date()
            }];
        }

        // Start new task
        this.newEntry.value = {
            task: exid,
            annotation: "Working...",
            start: new Date(),
            end: null
        };

        this.currentTask.value = this.tasks.value.find(x => x.exid === exid) || {};
        this.tasks.value = this.tasks.value.map(x => ({
            ...x,
            timingState: x.exid === exid ? "start" : "stop"
        }));
    }

    handleStopTask({ exid }) {
        if (this.newEntry.value.start) {
            let snappedStart = this.newEntry.value.start;
            const entries = this.entries.value;

            if (entries.length > 0) {
                const mostRecentEntry = findMostRecentEntryByEndTime(entries);
                if (mostRecentEntry && mostRecentEntry.end) {
                    const gapInMinutes = (snappedStart.getTime() - mostRecentEntry.end.getTime()) / (60 * 1000);
                    if (gapInMinutes > 0 && gapInMinutes <= this.settings.value.timeSnapThreshold) {
                        snappedStart = new Date(mostRecentEntry.end);
                    }
                }
            }

            let newEntries = [...entries, {
                ...this.newEntry.value,
                start: snappedStart,
                id: Date.now(),
                end: new Date(),
                lastModified: new Date()
            }];

            newEntries = sortByStart(newEntries);
            newEntries = calculateGaps(newEntries);
            this.entries.value = newEntries;
            this.newEntry.value = {};
        }

        this.currentTask.value = {};
        this.tasks.value = this.tasks.value.map(x => ({
            ...x,
            timingState: x.exid === exid ? "stop" : x.timingState
        }));

        this.recalculateTaskTotals();
        this.recalculateTotals();
    }

    handleAddTask({ raw, exid: providedExid, client: providedClient }) {
        const [exid, client, description] = extract([/#(\w+)/, /client:(\w+)/], raw || '');
        const taskExid = String(providedExid || exid || Date.now());
        const taskClient = providedClient || client;

        this.tasks.value = [...this.tasks.value, {
            exid: taskExid,
            client: taskClient,
            description,
            id: Date.now(),
            mostRecentEntry: new Date(),
            lastModified: new Date()
        }];

        // Update clients list
        if (taskClient) {
            const clientNames = new Set(this.clients.value.map(c => c.name));
            if (!clientNames.has(taskClient)) {
                this.clients.value = [...this.clients.value, { name: taskClient }];
            }
        }
    }

    handleDeleteTask({ exid }) {
        const taskToDelete = this.tasks.value.find(x => x.exid === exid);
        if (taskToDelete) {
            this.deletedTasks.value = [...this.deletedTasks.value, taskToDelete];
        }
        this.tasks.value = this.tasks.value.filter(x => x.exid !== exid);
    }

    handleTaskComplete({ exid, complete }) {
        this.tasks.value = this.tasks.value.map(x =>
            x.exid === exid ? { ...x, complete, synced: complete, lastModified: new Date() } : x
        );
        this.entries.value = this.entries.value.map(x =>
            x.task === exid ? { ...x, synced: complete } : x
        );
    }

    handleTaskSyncChanged({ exid, synced }) {
        this.tasks.value = this.tasks.value.map(x =>
            x.exid === exid ? { ...x, synced, lastModified: new Date() } : x
        );
        this.entries.value = this.entries.value.map(x =>
            x.task === exid ? { ...x, synced } : x
        );
    }

    handleUpdateSettings(data) {
        this.settings.value = { ...this.settings.value, ...data };
        if (data.timeSnapThreshold !== undefined) {
            this.timeSnapThreshold.value = data.timeSnapThreshold;
        }
    }

    handleImport({ data }) {
        const imported = JSON.parse(data);
        if (Array.isArray(imported)) {
            const newEntries = imported.map(x => ({
                ...x,
                id: x.id ? x.id.toString() + Date.now().toString() : Date.now(),
                task: x.task || (x.tags ? x.tags.join('_') : 'imported'),
                annotation: x.annotation || (x.tags ? x.tags.join(' ') : 'Imported ' + new Date()),
                start: new Date(x.start),
                end: new Date(x.end),
                lastModified: new Date()
            }));
            this.entries.value = [...this.entries.value, ...newEntries];
        }
        this.recalculateTotals();
    }

    recalculateTaskTotals() {
        const taskTotals = calculateTaskTotals(this.entries.value);
        this.tasks.value = mergeTasksWithTotals(this.tasks.value, taskTotals);
    }

    recalculateTotals() {
        const { durationTotal, durationTotalGaps } = calculateDurationTotals(this.entries.value);
        this.durationTotal.value = durationTotal;
        this.durationTotalGaps.value = durationTotalGaps;
    }

    // Persist state to storage
    async persistState() {
        await store.write({
            settings: this.settings.value,
            newEntry: this.newEntry.value,
            entries: this.entries.value,
            tasks: this.tasks.value,
            clients: this.clients.value,
            currentTask: this.currentTask.value,
            deleted: this.deleted.value,
            deletedTasks: this.deletedTasks.value
        });
    }
});
