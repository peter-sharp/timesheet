import Store from "./store.js";
import TimesheetDB from "./timesheetDb.js";

const APP_VERSION = "2.0"; // Bumped for IndexedDB migration

const INITIAL_STATE = {
    version: APP_VERSION,
    newEntry: {},
    entries: [],
    tasks: [],
    clients: [],
    currentTask: {},
    settings: {
        color: "#112233",
        focusInterval: 0.4,
        timeSnapThreshold: 6
    }
};

// localStorage adapter - UI state only (settings, newEntry, currentTask, clients)
export const localStorageAdapter = {
    async read() {
        try {
            const data = JSON.parse(localStorage.getItem('timesheet')) || {};
            return this.hydrate({ ...INITIAL_STATE, ...data });
        } catch (e) {
            console.error('LocalStorage read error:', e);
            return { ...INITIAL_STATE };
        }
    },

    async write(state) {
        try {
            // Only store UI state in localStorage
            const { entries, tasks, deleted, deletedTasks, export: exportData, ...uiState } = state;
            localStorage.setItem('timesheet', JSON.stringify({
                version: APP_VERSION,
                newEntry: uiState.newEntry || {},
                currentTask: uiState.currentTask || {},
                clients: uiState.clients || [],
                settings: uiState.settings || INITIAL_STATE.settings
            }));
        } catch (e) {
            console.error('LocalStorage write error:', e);
        }
    },

    hydrate(state) {
        return {
            ...INITIAL_STATE,
            ...state,
            version: APP_VERSION,
            newEntry: {
                ...state.newEntry,
                start: state.newEntry?.start ? new Date(state.newEntry.start) : null,
                end: state.newEntry?.end ? new Date(state.newEntry.end) : null
            },
            clients: Array.isArray(state.clients) ? state.clients : [],
            settings: { ...INITIAL_STATE.settings, ...state.settings }
        };
    }
};

// Export hydrate function for use in script.js
export const hydrate = (data) => localStorageAdapter.hydrate(data);

// sessionStorage adapter - deletions tracking only
const sessionStorageAdapter = {
    async read() {
        try {
            const data = JSON.parse(sessionStorage.getItem('timesheet')) || {};
            return {
                deleted: data.deleted || [],
                deletedTasks: data.deletedTasks || []
            };
        } catch (e) {
            console.error('SessionStorage read error:', e);
            return { deleted: [], deletedTasks: [] };
        }
    },

    async write(state) {
        try {
            sessionStorage.setItem('timesheet', JSON.stringify({
                deleted: state.deleted || [],
                deletedTasks: state.deletedTasks || []
            }));
        } catch (e) {
            console.error('SessionStorage write error:', e);
        }
    }
};

// IndexedDB adapter - tasks and entries
const indexedDBAdapter = {
    async read() {
        try {
            const db = await TimesheetDB();

            // Load only today's entries
            const entries = [];
            for await (const entry of db.getEntriesModifiedToday()) {
                entries.push({
                    ...entry,
                    start: new Date(entry.start),
                    end: new Date(entry.end),
                    lastModified: entry.lastModified ? new Date(entry.lastModified) : new Date()
                });
            }

            // Load only today's tasks
            const tasks = [];
            for await (const task of db.getTasksModifiedToday()) {
                tasks.push({
                    ...task,
                    lastModified: task.lastModified ? new Date(task.lastModified) : new Date()
                });
            }

            return { entries, tasks };
        } catch (e) {
            console.error('IndexedDB read error:', e);
            return { entries: [], tasks: [] };
        }
    },

    async write(state) {
        try {
            const db = await TimesheetDB();

            // Write tasks
            for (const task of state.tasks || []) {
                await upsert(task, db.addTask.bind(db), db.updateTask.bind(db));
            }

            // Write entries
            for (const entry of state.entries || []) {
                await upsert(entry, db.addEntry.bind(db), db.updateEntry.bind(db));
            }

            // Handle deletions
            for (const entry of state.deleted || []) {
                if (entry.id) {
                    await db.deleteEntry(entry.id);
                }
            }

            for (const task of state.deletedTasks || []) {
                if (task.exid) {
                    await db.deleteTask(task.exid);
                }
            }
        } catch (e) {
            console.error('IndexedDB write error:', e);
        }
    }
};

// Helper function to handle upsert operations
async function upsert(item, addFn, updateFn) {
    try {
        return await addFn(item);
    } catch (e) {
        if (e.name === 'ConstraintError') {
            return await updateFn(item);
        }
        throw e;
    }
}

// Create store instance with all adapters
const store = Store([
    localStorageAdapter,
    sessionStorageAdapter,
    indexedDBAdapter
]);

export default store;
