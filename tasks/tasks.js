import "../pie-progress.js";
import "./task-list.js";
import "./task-status.js";
import  calculateGaps  from "../utils/calculateGaps.js";
import extract from "../utils/extract.js";
import calcDuration from "../utils/calcDuration.js";
export default function tasks(el, model) {
    model.use([
        function tasks(state, ev) {
            switch (ev.type) {
                case "startTask":
                    console.log(ev)
                    if(state.newEntry.start) {
                        state.entries = [
                            ...state.entries,
                            {
                                ...state.newEntry,
                                id: Date.now(),
                                end: new Date()
                            }
                        ];
                        state.newEntry = {};
                    }
                    state.newEntry = {
                        task: ev.exid,
                        annotation: "Working...",
                        start: new Date(),
                        end:  null,
                    }
                    state.currentTask = state.tasks.find(x => x.exid == ev.exid);
                    state.tasks = state.tasks.map(x => x.exid == ev.exid ? {...x, timingState: "start"} : x);
                    break;
                case "stopTask":
                    console.log(ev)
                    if(state.newEntry.start) {
                          // Check if start time needs snapping to previous entry's end time
                            if (state.entries.length > 0 ) {
                                const mostRecentEntry = findMostRecentEntryByEndTime(state.entries);
                                
                                if (mostRecentEntry && mostRecentEntry.end) {
                                    // Calculate gap in minutes
                                    const gapInMinutes = (state.newEntry.start.getTime() - mostRecentEntry.end.getTime()) / (60 * 1000);
                                    
                                    // If gap is positive and within threshold, snap the start time
                                    if (gapInMinutes > 0 && gapInMinutes <= state.settings.timeSnapThreshold) {
                                        state.newEntry.start = new Date(mostRecentEntry.end);
                                    }
                                }
                            }
                        state.entries = [
                            ...state.entries,
                            {
                                ...state.newEntry,
                                id: Date.now(),
                                end: new Date()
                            }
                        ];
                        state.newEntry = {};
                    }
                    state = calculateGaps(state);
                    state.currentTask = {};
                    state.tasks = state.tasks.map(x => x.exid == ev.exid ? {...x, timingState: "stop"} : x);
                    break;
                case "addTask":
                    const [exid = Date.now(), client, description] = extract([/#(\w+)/, /client:(\w+)/], ev.raw);
                    const taskExid = ev.exid || exid || Date.now().toString();
                    // mostRecentEntry to ensure new tasks are at the top
                    state.tasks = [...state.tasks, { exid: taskExid, client: ev.client || client, description, id: Date.now(), mostRecentEntry: new Date()}]
                    // Ensure they are unique
                    // TODO handle clients with other properties than name 
                    state.clients = Array.from(new Set([...state.clients, {name: ev.client}].map(x => x.name))).map(x => ({name: x}))
                    break;
                case "taskSyncChanged":
                    state.tasks = state.tasks.map(x => x.exid == ev.exid ? {...x, synced: ev.synced} : x);
                    state.entries = state.entries.map(x => x.task == ev.exid ? {...x, synced: ev.synced} : x);
                    break;
                case "taskComplete":
                    state.tasks = state.tasks.map(x => x.exid == ev.exid ? {...x, complete: ev.complete, synced: ev.complete} : x);
                    state.entries = state.entries.map(x => x.task == ev.exid ? {...x, synced: ev.complete} : x);
                    break;
                case 'deleteTask':
                    const tasks = [];
                    state.deletedTasks = state.deletedTasks || [];
                    for (const x of state.tasks) {
                        if(x.exid == ev.exid) state.deletedTasks.push(x)
                        else tasks.push(x)
                    }
                    console.log(ev)
                    state.tasks = tasks
                    break;
            }
            switch(ev.type){
                case 'deleteTask':
                case "addTask":
                case "startTask":
                case "stopTask":
                case "taskSyncChanged":
                case "changedEntry":
                case "archive":
                    const taskTotals = {};
                    for (const entry of state.entries) {

                        //calc totals
                        taskTotals[entry.task] = taskTotals[entry.task] || { task: entry.task, total: 0, mostRecentEntry: new Date(0,0,0), synced: true };
                        taskTotals[entry.task].total += calcDuration(entry);
                        if(!entry.synced) taskTotals[entry.task].synced = false;
                        if(entry.start > taskTotals[entry.task].mostRecentEntry) taskTotals[entry.task].mostRecentEntry = entry.start;
                    }
                    // state.taskTotals = Object.entries(taskTotals).map(([task, stats]) => ({task, ...stats}));
                    let tasks = [];
                    const oldTasks = state.tasks.map(x => typeof x == "string" ? { exid: x, description: x } : x)
                    if(oldTasks.length >= Object.keys(taskTotals).length) {
                        for (const task of oldTasks) {
                            tasks.push({...task, ...(taskTotals[task.exid] || { total: 0 })});
                        }
                    } else {
                        const tasksByExid = oldTasks.reduce((xs, x) => ({...xs, [x.exid]: x}), {})
                        for (const [exid, stats] of Object.entries(taskTotals)) {
                            tasks.push({...(tasksByExid[exid] || {}), ...stats, exid});
                        }
                    }

                    // merging values
                    const tasksByExid = tasks.reduce((xs, x) => ({...xs, [x.exid]: {...(xs[x.exid] || []), ...x}}), {});
                    tasks = Object.values(tasksByExid);
                    state.tasks = tasks;
                    break;
            }
            return state
        }
    ]);

    // Helper function to find the most recent entry by end time
    function findMostRecentEntryByEndTime(entries) {
        if (!entries || entries.length === 0) return null;
        
        return entries.reduce((mostRecent, current) => {
            if (!mostRecent || !mostRecent.end) return current;
            if (!current.end) return mostRecent;
            
            return current.end > mostRecent.end ? current : mostRecent;
        }, null);
    }
}
