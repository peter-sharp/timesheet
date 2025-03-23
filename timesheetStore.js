import  Store  from "./store.js";

const APP_VERSION = "0.2.7";

function migrate(state, fromVersion) {
    // Handle migrations based on version changes
    if (!fromVersion || fromVersion < "0.2.7") {
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
    }
    return state;
}

const store = Store(
    'timesheet',
    hydrate,
    function dehydrate(state) {
        if(state.settings && !state.settings.color) state.settings.color = "#112233";
        if(state.export) state.export = null;
        return {
            ...state,
            version: APP_VERSION
        };
    },
    function storageTypeSort({deleted, deletedTasks, ...local}) {
        return {
            session: { deleted, deletedTasks},
            local
        }
    }, 
    {
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
    }
);

export function hydrate(state) {
    // Run migrations if version has changed
    const fromVersion = state.version;
    if (fromVersion !== APP_VERSION) {
        state = migrate(state, fromVersion);
    }

    // Ensure archive structure exists
    const archive = {
        entries: Array.isArray(state.archive) ? state.archive : (state.archive?.entries || []),
        tasks: Array.isArray(state.archivedTasks) ? state.archivedTasks : (state.archive?.tasks || [])
    };

    return {
        export: null,
        ...state,
        version: APP_VERSION,
        archive,
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
        archive: {
            ...archive,
            entries: archive.entries.map(entry => ({
                ...entry,
                start: new Date(entry.start),
                end: new Date(entry.end)
            }))
        },
        tasks: Array.isArray(state.tasks) ? state.tasks : [],
        taskTotals: Array.isArray(state.taskTotals) ? state.taskTotals : [],
        clients: Array.isArray(state.clients) ? state.clients : [],
    };
}

export default store;