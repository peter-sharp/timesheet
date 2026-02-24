import {ContextProvider} from './utils/Context.js';
import signal from './utils/Signal.js';
import store from './timesheetStore.js';
import TimesheetDB from './timesheetDb.js';
import calcDuration from './utils/calcDuration.js';
import reduce from './utils/reduce.js';
import reduceDuration from './utils/reduceDuration.js';
import extract from './utils/extract.js';
import first from './utils/first.js';
import last from './utils/last.js';
import { syncOutbound, syncInbound } from './syncEngine.js';

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
    allTasks = signal([])
    todaysTasks = signal([])
    allTasksWithDeleted = signal([])

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
        stats: this.stats,
        allTasks: this.allTasks,
        todaysTasks: this.todaysTasks,
        allTasksWithDeleted: this.allTasksWithDeleted
    });

    connectedCallback() {
        this.style.display = 'contents';

        // Listen for state update events from child components
        this._handleStateEvent = this.handleStateEvent.bind(this);
        this.addEventListener('updateState', this._handleStateEvent);

        // Start midnight rollover check
        this._currentDate = new Date().toDateString();
        this._scheduleRolloverCheck();

        // Sync inbound from linked files when tab regains focus
        this._handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Check for date rollover immediately when tab becomes visible.
                // requestIdleCallback won't fire while the computer is sleeping, so
                // stale state from yesterday can persist until the user returns to the tab.
                const now = new Date().toDateString();
                if (now !== this._currentDate) {
                    this._currentDate = now;
                    this._reloadTodayData();
                    return; // _reloadTodayData handles sync as well
                }

                requestIdleCallback(async () => {
                    try {
                        const merged = await syncInbound(this.tasks.value);
                        if (merged) {
                            this.tasks.value = merged;
                            this.recalculateTaskTotals();
                            this.persistState();
                        }
                    } catch (e) {
                        console.warn('File sync inbound failed:', e);
                    }
                });
            }
        };
        document.addEventListener('visibilitychange', this._handleVisibilityChange);
    }

    disconnectedCallback() {
        this.removeEventListener('updateState', this._handleStateEvent);
        document.removeEventListener('visibilitychange', this._handleVisibilityChange);
    }

    // Check if the date has rolled over (app left open past midnight)
    _scheduleRolloverCheck() {
        requestIdleCallback(() => {
            if (!this.isConnected) return;
            const now = new Date().toDateString();
            if (now !== this._currentDate) {
                this._currentDate = now;
                this._reloadTodayData();
            }
            // Re-schedule (checks roughly every idle period)
            this._scheduleRolloverCheck();
        }, { timeout: 60000 });
    }

    async _reloadTodayData() {
        const freshState = await store.read();
        this.entries.value = [...freshState.entries];
        this.tasks.value = [...freshState.tasks];
        await this._ensureEntryTasksLoaded();
        this.recalculateTaskTotals();
        this.recalculateTotals();
        await this.refreshTaskLists();
    }

    // Loads full task data for tasks referenced by today's entries but missing from
    // today's task list (e.g. the task's lastModified is from a previous day but the
    // user worked on it again today). Updates lastModified to today in the DB so the
    // task appears correctly on subsequent reloads.
    async _ensureEntryTasksLoaded() {
        const entryExids = [...new Set(this.entries.value.map(e => e.task))];
        const missingExids = entryExids.filter(exid => !this.tasks.value.find(t => t.exid === exid));
        if (missingExids.length === 0) return;

        const db = await TimesheetDB();
        const allTasks = await db.getAllTasks();
        const today = new Date();
        const loadedTasks = [];

        for (const exid of missingExids) {
            const task = allTasks.find(t => t.exid === exid);
            if (task) {
                // Touch lastModified so this task is included in getTasksModifiedToday() on next load
                await db.updateTask({ ...task, lastModified: today }, { preserveTimestamp: false });
                loadedTasks.push({ ...task, lastModified: today });
            }
        }

        if (loadedTasks.length > 0) {
            this.tasks.value = [...this.tasks.value, ...loadedTasks];
        }
    }

    // Refresh task lists from database (for datalist components)
    async refreshTaskLists() {
        const db = await TimesheetDB();
        this.allTasks.value = await db.getRecentTasks(500);
        this.todaysTasks.value = await db.getTodaysTasks();
        this.allTasksWithDeleted.value = await db.getAllTasksIncludingDeleted(500);
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

        // Load full task data for any tasks referenced by today's entries but not in
        // today's task list (e.g. task lastModified is from a prior day)
        await this._ensureEntryTasksLoaded();

        // Calculate initial totals
        this.recalculateTaskTotals();
        this.recalculateTotals();

        // Load task lists for different datalist components
        const db = await TimesheetDB();
        this.allTasks.value = await db.getRecentTasks(500);
        this.todaysTasks.value = await db.getTodaysTasks();
        this.allTasksWithDeleted.value = await db.getAllTasksIncludingDeleted(500);

        // Initial file sync when app loads (idle)
        requestIdleCallback(async () => {
            try {
                const merged = await syncInbound(this.tasks.value);
                if (merged) {
                    this.tasks.value = merged;
                    this.recalculateTaskTotals();
                    this.persistState();
                }
            } catch (e) {
                console.warn('File sync initial inbound failed:', e);
            }
        });
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
            case 'addTasks':
                this.handleAddTasks(data);
                break;
            case 'deleteTask':
                this.handleDeleteTask(data);
                break;
            case 'taskComplete':
                this.handleTaskComplete(data);
                break;
            case 'taskStatusChanged':
                this.handleTaskStatusChanged(data);
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
            const newTask = { exid: task, id: Date.now(), mostRecentEntry: new Date(), total: 0, lastModified: new Date() };
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

    async handleChangedEntry({ id, task, annotation, start, end }) {
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
            // Load task from database if it exists (preserve timestamp)
            const db = await TimesheetDB();
            const allTasks = await db.getAllTasks();
            const existingTask = allTasks.find(t => t.exid === task);

            if (existingTask) {
                // Load existing task with original timestamp
                this.tasks.value = [...this.tasks.value, existingTask];
            } else {
                // Create new task with today's timestamp
                this.tasks.value = [...this.tasks.value, { exid: task, lastModified: new Date() }];
            }
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
        // Extract all known patterns from raw input
        const [exid, project, context, client, due, estimate, description] = extract(
            [/#(\w+)/, /\+(\S+)/, /@(\S+)/, /\bclient:(\w+)/, /\bdue:(\S+)/, /\bestimate:(\S+)/],
            raw || ''
        );
        const taskExid = String(providedExid || exid || Date.now());
        const taskClient = providedClient || client;

        // Extract any additional key:value metadata and clean description
        const metadata = {};
        const knownKeys = new Set(['client', 'due', 'estimate']);
        const metadataPattern = /\b(\w+):(\S+)/g;
        let metaMatch;
        let cleanDescription = description || '';

        while ((metaMatch = metadataPattern.exec(description || '')) !== null) {
            const key = metaMatch[1];
            const value = metaMatch[2];

            // Collect unknown metadata
            if (!knownKeys.has(key)) {
                metadata[key] = value;
            }

            // Remove ALL key:value patterns from description (both known and unknown)
            cleanDescription = cleanDescription.replace(metaMatch[0], '');
        }

        // Clean up description (remove extra spaces)
        cleanDescription = cleanDescription.trim().replace(/\s+/g, ' ');

        // Check if task with this exid already exists
        const existingTaskIndex = this.tasks.value.findIndex(t => t.exid === taskExid);

        if (existingTaskIndex !== -1) {
            // Update existing task with new info
            this.tasks.value = this.tasks.value.map((task, index) =>
                index === existingTaskIndex
                    ? {
                        ...task,
                        client: taskClient || task.client,
                        project: project || task.project,
                        context: context || task.context,
                        description: cleanDescription || task.description,
                        ...(Object.keys(metadata).length > 0 ? { metadata: { ...task.metadata, ...metadata } } : {}),
                        lastModified: new Date()
                    }
                    : task
            );

            // Update task lists for datalist components
            const updatedTask = this.tasks.value[existingTaskIndex];
            this.todaysTasks.value = this.todaysTasks.value.map(t =>
                t.exid === taskExid ? updatedTask : t
            );
            this.allTasksWithDeleted.value = this.allTasksWithDeleted.value.map(t =>
                t.exid === taskExid ? updatedTask : t
            );
        } else {
            // Add new task
            const newTask = {
                exid: taskExid,
                client: taskClient,
                project: project || '',
                context: context || '',
                description: cleanDescription,
                ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
                id: Date.now(),
                mostRecentEntry: new Date(),
                lastModified: new Date()
            };

            this.tasks.value = [...this.tasks.value, newTask];

            // Update task lists for datalist components
            this.todaysTasks.value = [newTask, ...this.todaysTasks.value];
            this.allTasksWithDeleted.value = [newTask, ...this.allTasksWithDeleted.value];
        }

        // Update clients list
        if (taskClient) {
            const clientNames = new Set(this.clients.value.map(c => c.name));
            if (!clientNames.has(taskClient)) {
                this.clients.value = [...this.clients.value, { name: taskClient }];
            }
        }
    }

    handleAddTasks({ tasks: taskInputs }) {
        const newTasks = [];
        const updatedTasks = [];
        const newClients = new Set(this.clients.value.map(c => c.name));
        const addedClients = [];

        for (const { raw } of taskInputs) {
            // Extract all known patterns from raw input
            const [exid, project, context, client, due, estimate, description] = extract(
                [/#(\w+)/, /\+(\S+)/, /@(\S+)/, /\bclient:(\w+)/, /\bdue:(\S+)/, /\bestimate:(\S+)/],
                raw || ''
            );
            const taskExid = String(exid || Date.now() + newTasks.length);
            const taskClient = client || '';

            // Extract any additional key:value metadata
            const metadata = {};
            const knownKeys = new Set(['client', 'due', 'estimate']);
            const metadataPattern = /\b(\w+):(\S+)/g;
            let metaMatch;
            let cleanDescription = description || '';

            while ((metaMatch = metadataPattern.exec(description || '')) !== null) {
                const key = metaMatch[1];
                const value = metaMatch[2];
                if (!knownKeys.has(key)) {
                    metadata[key] = value;
                    // Remove this metadata from description
                    cleanDescription = cleanDescription.replace(metaMatch[0], '');
                }
            }

            // Clean up description (remove extra spaces)
            cleanDescription = cleanDescription.trim().replace(/\s+/g, ' ');

            // Check if task with this exid already exists
            const existingTask = this.tasks.value.find(t => t.exid === taskExid);

            if (existingTask) {
                // Update existing task with new info
                updatedTasks.push({
                    ...existingTask,
                    client: taskClient || existingTask.client,
                    project: project || existingTask.project,
                    context: context || existingTask.context,
                    description: cleanDescription || existingTask.description,
                    ...(Object.keys(metadata).length > 0 ? { metadata: { ...existingTask.metadata, ...metadata } } : {}),
                    lastModified: new Date()
                });
            } else {
                // Add new task
                newTasks.push({
                    exid: taskExid,
                    client: taskClient,
                    project: project || '',
                    context: context || '',
                    description: cleanDescription,
                    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
                    id: Date.now() + newTasks.length,
                    mostRecentEntry: new Date(),
                    lastModified: new Date()
                });
            }

            if (taskClient && !newClients.has(taskClient)) {
                newClients.add(taskClient);
                addedClients.push({ name: taskClient });
            }
        }

        // Apply updates to existing tasks and add new tasks
        let updatedTasksValue = this.tasks.value.map(task => {
            const updated = updatedTasks.find(u => u.exid === task.exid);
            return updated || task;
        });

        this.tasks.value = [...updatedTasksValue, ...newTasks];

        // Update task lists for datalist components
        if (newTasks.length > 0) {
            this.todaysTasks.value = [...newTasks, ...this.todaysTasks.value];
            this.allTasksWithDeleted.value = [...newTasks, ...this.allTasksWithDeleted.value];
        }

        // Update existing tasks in datalist components
        if (updatedTasks.length > 0) {
            this.todaysTasks.value = this.todaysTasks.value.map(t => {
                const updated = updatedTasks.find(u => u.exid === t.exid);
                return updated || t;
            });
            this.allTasksWithDeleted.value = this.allTasksWithDeleted.value.map(t => {
                const updated = updatedTasks.find(u => u.exid === t.exid);
                return updated || t;
            });
        }

        if (addedClients.length) {
            this.clients.value = [...this.clients.value, ...addedClients];
        }
    }

    handleDeleteTask({ exid }) {
        const taskToDelete = this.tasks.value.find(x => x.exid === exid);
        if (taskToDelete) {
            this.deletedTasks.value = [...this.deletedTasks.value, taskToDelete];

            // Update task lists: remove from today's tasks and move to end of allTasksWithDeleted
            this.todaysTasks.value = this.todaysTasks.value.filter(x => x.exid !== exid);

            // Mark as deleted in allTasksWithDeleted list
            const deletedTask = { ...taskToDelete, deleted: true };
            const nonDeleted = this.allTasksWithDeleted.value.filter(x => x.exid !== exid && !x.deleted);
            const deleted = this.allTasksWithDeleted.value.filter(x => x.deleted);
            this.allTasksWithDeleted.value = [...nonDeleted, ...deleted, deletedTask];
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

    handleTaskStatusChanged({ exid, status }) {
        const complete = status === "complete";
        this.tasks.value = this.tasks.value.map(x =>
            x.exid === exid ? { ...x, status, complete, synced: complete, lastModified: new Date() } : x
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
        // Outbound file sync (idle, coalesced)
        syncOutbound(this.tasks.value);
    }
});
