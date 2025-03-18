import  Store  from "./store.js";
const store = Store(
    'timesheet',
    hydrate,
    function dehydrate(state) {
        if(state.settings && !state.settings.color) state.settings.color = "#112233";
        if(state.export) state.export = null;
        return {...state };
    },
    function storageTypeSort({deleted, deletedTasks, ...local}) {
        return {
            session: { deleted, deletedTasks},
            local
        }
    }, 
    {
        newEntry: {},
        entries: [],
        clients: [],
        archive: [],
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
    return {
        export: null,
        ...state,
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
        archive: state.archive.map(entry => ({
            ...entry,
            start: new Date(entry.start),
            end: new Date(entry.end)
        })),
        tasks: Array.isArray(state.tasks) ? state.tasks : [],
        taskTotals: Array.isArray(state.taskTotals) ? state.taskTotals : [],
        clients: Array.isArray(state.clients) ? state.clients : [],
        
    };
   
}

export default store;