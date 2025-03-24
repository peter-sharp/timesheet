import Store from "./store.js";
import TimesheetDB from "./timesheetDb.js";

const APP_VERSION = "0.3.1";

//TODO: Fix issue breaking archive migration, when migrating from 0.2.7 to 0.3.1
//HACK: Create backup of timesheet data in localStorage, if it doesn't exist.

if(!localStorage.getItem('timesheetBackup')) {
    localStorage.setItem('timesheetBackup', localStorage.getItem('timesheet'));
}

const INITIAL_STATE = {
    version: APP_VERSION,
    newEntry: {},
    entries: [],
    clients: [],
    archive: {
        entries: [],
        tasks: []
    },
    tasks: new Set(),
    settings: {
        color: "#112233",
        focusInterval: 0.4,
        export: null
    },
    stats: {},
};

// Create localStorage adapter with exported hydrate function
export const localStorageAdapter = {
    async read() {
        try {
            const data = JSON.parse(localStorage.getItem('timesheet')) || {};
            return await this.hydrate({...INITIAL_STATE, ...data});
        } catch (e) {
            console.error('LocalStorage read error:', e);
            return {};
        }
    },
    async write(state) {
        try {
            const dehydratedData = await this.dehydrate(state);
            const { deleted, deletedTasks, export: exportData, ...localData } = dehydratedData;
            localStorage.setItem('timesheet', JSON.stringify({
                ...localData,
                version: APP_VERSION
            }));
        } catch (e) {
            console.error('LocalStorage write error:', e);
            throw e;
        }
    },
    async hydrate(state) {
        // Run migrations if version has changed
        const fromVersion = state.version;
        if (fromVersion !== APP_VERSION) {
            state = await migrate(state, fromVersion);
        }

        return {
            export: null,
            ...state,
            version: APP_VERSION,
            newEntry: {
                ...state.newEntry,
                start: state.newEntry.start ? new Date(state.newEntry.start) : null,
                end: state.newEntry.end ? new Date(state.newEntry.end) : null
            },
            entries: state.entries.map(entry => ({
                ...entry,
                start: new Date(entry.start),
                end: new Date(entry.end)
            })),
            tasks: Array.isArray(state.tasks) ? state.tasks : [],
            taskTotals: Array.isArray(state.taskTotals) ? state.taskTotals : [],
            clients: Array.isArray(state.clients) ? state.clients : [],
        };
    },
    async dehydrate(state) {
        if(state.settings && !state.settings.color) state.settings.color = "#112233";
        if(state.export) state.export = null;
        return {
            ...state,
            version: APP_VERSION
        };
    }
};

// Export hydrate function directly from localStorage adapter
export const hydrate = localStorageAdapter.hydrate.bind(localStorageAdapter);

// Create sessionStorage adapter
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
            return {};
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
            throw e;
        }
    }
};

// Create IndexedDB adapter
const indexedDBAdapter = {
    async read() {
        try {
            const db = await TimesheetDB();
            const archive = {
                entries: [],
                tasks: []
            };

            // Load tasks
            for await (const task of db.getTasks()) {
                archive.tasks.push(task);
            }

            // Load entries
            for await (const entry of db.getEntries()) {
                archive.entries.push({
                    ...entry,
                    start: new Date(entry.start),
                    end: new Date(entry.end)
                });
            }

            return { archive };
        } catch (e) {
            console.error('IndexedDB read error:', e);
            return {};
        }
    },
    async write(state) {
        // Only write archive data to IndexedDB
        if (!state.archive) return;

        try {
            const db = await TimesheetDB();
            
            // Write tasks
            for (const task of state.archive.tasks || []) {
                await db.addTask(task);
            }

            // Write entries
            for (const entry of state.archive.entries || []) {
                await db.addEntry({
                    ...entry,
                    start: new Date(entry.start),
                    end: new Date(entry.end)
                });
            }
        } catch (e) {
            console.error('IndexedDB write error:', e);
            throw e;
        }
    }
};

async function migrate(state, fromVersion) {
    // Handle migrations based on version changes

    if(!state.archiveBackup) { 
        state.archiveBackup = [...state.archive];
    }

    if (!fromVersion || fromVersion < "0.3.1") {
        // Migrate archive structure for 0.2.7
      
        
        const archive = {
            entries: Array.isArray(state.archive) ? state.archive : (state.archive?.entries || []),
            tasks: state.archivedTasks || []
        };
        
        // Remove old archivedTasks property
        const { archivedTasks, ...restState } = state;
        state = {
            ...restState,
            archive
        };

        // Migrate archive data to IndexedDB
        try {
            const db = await TimesheetDB();
            
            // Migrate archived tasks
            for (const task of state.archive.tasks || []) {
                await db.addTask(task);
            }

            // Migrate archived entries
            for (const entry of state.archive.entries || []) {
                await db.addEntry({
                    ...entry,
                    start: new Date(entry.start),
                    end: new Date(entry.end)
                });
            }

            // Clear migrated data from localStorage
            const { archive, ...restState } = state;
            state = {
                ...restState,
                archive: {
                    entries: [],
                    tasks: []
                }
            };
        } catch (e) {
            console.error('Migration to IndexedDB failed:', e);
        }
    }

    return state;
}

// Create store instance with all adapters
const store = Store([
    localStorageAdapter,
    sessionStorageAdapter,
    indexedDBAdapter
]);

export default store;