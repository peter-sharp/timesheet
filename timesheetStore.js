import  Store  from "./store.js";
const store = Store(
    'timesheet',
    hydrate,
    function dehydrate(state) {
        if(state.settings && !state.settings.color) state.settings.color = "#112233";
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
        archive: [],
        tasks: new Set(),
        settings: {
            color: "#112233",
            focusInterval: 0.4
        },
        stats: {},
    }
);

export function hydrate(state) {
    state.newEntry = {
        ...state.newEntry,
        start: state.newEntry.start ? new Date(state.newEntry.start) : null,
        end: state.newEntry.end ? new Date(state.newEntry.end) : null
    };
    state.entries = state.entries.map(
        ({ start, end, ...x }) => ({
            start: new Date(start),
            end: new Date(end),
            ...x
        })
    );
    state.archive = state.archive.map(
        ({ start, end, ...x }) => ({
            start: new Date(start),
            end: new Date(end),
            ...x
        })
    );


    state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
    state.taskTotals = Array.isArray(state.taskTotals) ? state.taskTotals : [];
    
    return state;
}

export default store;