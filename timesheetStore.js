import Store from "./store.js";
import TimesheetDB from "./timesheetDb.js";
import { signal } from "./utils/Signal.js";

const APP_VERSION = "1.2.3"; // Update this version when making changes

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

            return await this.hydrate({ ...INITIAL_STATE, ...data });
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
            state = await migrate(state, fromVersion, APP_VERSION);
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
            taskTotals: Array.isArray(state.taskTotals) ? state.taskTotals : [],
            clients: Array.isArray(state.clients) ? state.clients : [],
            entries: Array.isArray(state.entries) ? state.entries.map(entry => ({
                ...entry,
                start: entry.start ? new Date(entry.start) : null,
                end: entry.end ? new Date(entry.end) : null
            })) : []
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

export const totalPagesSignal = signal(0); // Signal for total pages

// Create IndexedDB adapter
const indexedDBAdapter = {
    async read({ archivedTasksSearchTerm = "", archiveBrowserTaskPage = 0, archiveBrowserTaskPageSize = 20 } = {}) {
        try {
            const db = await TimesheetDB();
            const archive = {
                entries: [],
                tasks: []
            };

            // Load entries
            for await (const entry of db.getEntries()) {
                archive.entries.push({
                    ...entry,
                    start: new Date(entry.start),
                    end: new Date(entry.end)
                });
            }

            // Load tasks with filtering and pagination
            const allTasks = [];
            for await (const task of db.getTasks()) {
                if (
                    (!archivedTasksSearchTerm || task.description?.toLowerCase().includes(archivedTasksSearchTerm.toLowerCase()) ||
                        task.client?.toLowerCase().includes(archivedTasksSearchTerm.toLowerCase()) ||
                        task.exid?.toString().toLowerCase().includes(archivedTasksSearchTerm.toLowerCase()))
                ) {
                    allTasks.push(task);
                }
            }

            const totalTasks = allTasks.length;
            totalPagesSignal.value = Math.ceil(totalTasks / archiveBrowserTaskPageSize); // Update total pages signal

            const offset = archiveBrowserTaskPage * archiveBrowserTaskPageSize;
            archive.tasks = allTasks.slice(offset, offset + archiveBrowserTaskPageSize);

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
            
            const errors = [];
            // Write tasks with upsert
            for (const task of state.archive.tasks || []) {
                try {
                    await upsert(task, db.addTask.bind(db), db.updateTask.bind(db));
                } catch (e) {
                    console.error('IndexedDB write error:', e);
                    errors.push(e);
                }
            }

            // Write entries with upsert
            for (const entry of state.archive.entries || []) {
                try {
                    await upsert(entry, db.addEntry.bind(db), db.updateEntry.bind(db));
                } catch (e) {
                    console.error('IndexedDB write error:', e);
                    errors.push(e);
                }
            }

            if (errors.length > 0) {
                throw new Error('IndexedDB write errors: ' + errors.map(e => e.message).join(', '));
            }
        } catch (e) {
            console.error('store write error:', e);
        }
    }
};

async function migrate(state, fromVersion, toVersion) {
    // Handle migrations based on version changes

    if (!fromVersion || fromVersion < '0.3.7') {
        console.log('migrating from version', fromVersion, 'to', toVersion);
        // Check for backup data in localStorage
        const backupData = localStorage.getItem('timesheetBackup');
        if (backupData) {
            try {
                const parsedBackup = JSON.parse(backupData);
                const backupArchive = {
                    entries: Array.isArray(parsedBackup.archive) ? parsedBackup.archive : (parsedBackup.archive?.entries || []),
                    tasks: parsedBackup.archivedTasks || []
                };

                debugger;

                // Merge with current archive data
                const archive = {
                    entries: [
                        ...(Array.isArray(state.archive) ? state.archive : (state.archive?.entries || [])),
                        ...backupArchive.entries
                    ],
                    tasks: [
                        ...(state.archivedTasks || []),
                        ...backupArchive.tasks
                    ]
                };

                debugger;
                console.log('archive', archive);
                // Remove old archivedTasks property
                const { archivedTasks, ...restState } = state;
                state = {
                    ...restState,
                    archive
                };

                debugger;
                // Migrate merged archive data to IndexedDB
                try {
                    const db = await TimesheetDB();
                    
                    // Migrate archived tasks
                    for (const task of state.archive.tasks || []) {
                        try {
                            await upsert(task, db.addTask.bind(db), db.updateTask.bind(db));
                        } catch (e) {
                            console.error('Migration to IndexedDB failed:', e);
                        }
                    }

                    // Migrate archived entries
                    for (const entry of state.archive.entries || []) {
                        try {
                            await upsert(
                                {
                                    ...entry,
                                    start: new Date(entry.start),
                                    end: new Date(entry.end)
                                },
                                db.addEntry.bind(db),
                                db.updateEntry.bind(db)
                            );
                        } catch (e) {
                            console.error('Migration to IndexedDB failed:', e);
                        }
                    }
                } catch (e) {
                    console.error('Migration to IndexedDB failed:', e);
                }
            } catch (e) {
                console.error('Failed to parse backup data:', e);
            }
        } else {
            // Original migration logic for when no backup exists
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
                    await upsert(task, db.addTask.bind(db), db.updateTask.bind(db));
                }

                // Migrate archived entries
                for (const entry of state.archive.entries || []) {
                    await upsert(
                        {
                            ...entry,
                            start: new Date(entry.start),
                            end: new Date(entry.end)
                        },
                        db.addEntry.bind(db),
                        db.updateEntry.bind(db)
                    );
                }
            } catch (e) {
                console.error('Migration to IndexedDB failed:', e);
            }
        }
    }

    return state;
}

// Helper function to handle upsert operations
async function upsert(item, addFn, updateFn) {
    try {
        return await addFn(item);
    } catch (e) {
        // If the error is due to a uniqueness constraint violation
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
