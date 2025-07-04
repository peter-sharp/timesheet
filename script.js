import { Model } from "./model.js";
import  "./app-context.js";
import  "./timesheet.js";
import "./time-duration.js";
import  "./hash-router.js";
import  "./hash-nav.js";
import  "./current-task.js";
import './archive/archive-stats.js';
import timeLoop from "./utils/timeLoop.js";
import calcDuration, { formatDurationToStandard, hoursToMilliseconds } from "./utils/calcDuration.js";
import { offsetHue, hexToHsla } from "./utils/colorUtils.js";

import first from "./utils/first.js";
import last from "./utils/last.js";

// Helper function to find the most recent entry by end time
function findMostRecentEntryByEndTime(entries) {
    if (!entries || entries.length === 0) return null;
    
    return entries.reduce((mostRecent, current) => {
        if (!mostRecent || !mostRecent.end) return current;
        if (!current.end) return mostRecent;
        
        return current.end > mostRecent.end ? current : mostRecent;
    }, null);
}
import store from "./timesheetStore.js";
import archive from "./archive/archive.js";
import  tasks from "./tasks/tasks.js";
import sync from "./sync/sync.js";
import reduce from "./utils/reduce.js";
import  reduceDuration  from "./utils/reduceDuration.js";
import { calculateGaps } from "./utils/calculateGaps.js";
import { hydrate } from "./timesheetStore.js";

// TODO: Move from redux-style state management to Signals.

const APP_VERSION = "0.3.9.1";

(async () => {

    if('serviceWorker' in navigator) {
        try {
            console.log('CLIENT: registering service worker.');
            await navigator.serviceWorker.register(`./serviceWorker.js?version=${APP_VERSION}`);
            console.log('CLIENT: service worker registration complete.');
        } catch(e) {
            console.error(e);
        }
    }

    // Initialize default settings
    const defaultSettings = {
        timeSnapThreshold: 6 // Default to 6 minutes for time-snapping
    };

    const model = Model([
            function newEntry(state, ev) {
                const { type, ...data } = ev
                switch (type) {
                    case 'newEntry':
                        state.newEntry = {...data};
                        state.currentTask = state.tasks.find(x => x.exid == ev.task);
                        console.log(state)
                        if(!state.currentTask) {
                            state.currentTask = { exid: ev.task, id: Date.now(), mostRecentEntry: new Date(), total: 0 }
                            state.tasks = [...state.tasks, state.currentTask];
                        }
                        state.tasks = state.tasks.map(x =>  ({...x, timingState: x.exid == ev.task ? "start" : "stop" }) );
                        break;
                    case 'clearNewEntry':
                        state.newEntry = {};
                        state.currentTask = {};
                        break;
                }
                return state;
            },
            
            function updateEntry(state, ev) {
                const { id, type, ...change } = ev
                switch (type) {

                    case "changedEntry":
                        console.log({id, type, change})
                        if (id) {
                            // updating existing entry
                            state.entries = state.entries.map(x => x.id == id ? {...x, ...change } : x);
                           
                        } else {
                            // Check if start time needs snapping to previous entry's end time
                            if (state.entries.length > 0 && change.start) {
                                const mostRecentEntry = findMostRecentEntryByEndTime(state.entries);
                                
                                if (mostRecentEntry && mostRecentEntry.end) {
                                    // Calculate gap in minutes
                                    const gapInMinutes = (change.start.getTime() - mostRecentEntry.end.getTime()) / (60 * 1000);
                                    
                                    // If gap is positive and within threshold, snap the start time
                                    if (gapInMinutes > 0 && gapInMinutes <= state.settings.timeSnapThreshold) {
                                        change.start = new Date(mostRecentEntry.end);
                                    }
                                }
                            }
                            
                            // adding new entry
                            state.entries = [
                                ...state.entries,
                                {
                                    id: Date.now(),
                                    ...change
                                }
                            ];
                            state.newEntry = {};
                            state.tasks = state.tasks.map(x => x.exid == ev.task ? {...x, timingState: "stop"} : x);
                        }
                        state.entries.sort(function sortByStart(a,b) {
                            a.start = new Date(a.start);
                            b.start = new Date(b.start);
                            if(a.start.getTime() < b.start.getTime()) return -1;
                            if(a.start.getTime() > b.start.getTime()) return 1;
                            return 0;
                        })
                        state = calculateGaps(state);
                        state.tasks = [...Array.from(state.tasks), { exid: change.task }];
        
                        
                        break;
                    case 'deleteEntry':
                        const entries = [];
                        state.deleted = state.deleted || [];
                        for (const x of state.entries) {
                            if(x.id == ev.id) state.deleted.push(x)
                            else entries.push(x)
                        }
                        state.entries = entries
                        break;
                   
                }

                console.log(state.entries);

                return state;
            },
            function calcEntriesStats(state, ev) {
                state.durationTotal = reduce(reduceDuration, 0, state.entries);
                const { start } = first(state.entries) || {};
                const { end } = last(state.entries) || {};
                const durationTotalNoGaps = calcDuration({ start, end });
                state.durationTotalGaps = durationTotalNoGaps - state.durationTotal;
                return state;
            },
            async function settings(state, ev) {
                switch (ev.type) {
                    case 'import':
                        const data = JSON.parse(ev.data);
                        if(Array.isArray(data)) {
                            const imported = data.map(x => {
                                let start = new Date(x.start); 
                                let end = new Date(x.end); 
                                if(isNaN(start)) {
                                    start = importTimewtime(x.start)
                                }
                                if(isNaN(end)) {
                                    end = importTimewtime(x.end)
                                }
                                return {
                                    ...x,
                                    id: x.id.toString() + Date.now().toString(),
                                    task: x.task || x.tags.join('_'),
                                    annotation: x.annotation || x.tags ? x.tags.join(' ') : 'Imported '+ new Date(),
                                    start,
                                    end
                                }
                            });
                            state.archive = {...state.archive, entries: [...state.archive.entries, ...imported]};
                        } else {
                            state = {...state, ...await hydrate(data)};
                        }
                        break;
                    case "export":
                        state.export = JSON.stringify(state)
                        break;
                    case "updateSettings":
                        state.settings = {...state.settings, ...ev.data}
                        break;
                    default:
                        break;
                }
                return state;
            },
        ],
        await store.read()
    );

    console.log("Initial state loaded:", model.state); // Log the initial state
    
    // Ensure default settings are present
    model.state.settings = { ...defaultSettings, ...model.state.settings };

     //TODO: remove this when model replaced by signals
     const appContext = document.querySelector('app-context');
     model.listen(appContext.update.bind(appContext));

    const timeSheet = document.querySelector('time-sheet');
    model.listen(timeSheet.update.bind(timeSheet));

  
    tasks(document.getElementById('tasks'), model);
    sync(document.getElementById('sync'), model);
    archive(document.getElementById('archive'), model);
    settings(document.getElementById('settings'), model);
   
    const archiveStats = document.querySelector('archive-stats');
    model.listen(archiveStats.update.bind(archiveStats));

    document.body.addEventListener("updateState", function updateState(ev) {
        model.emit(ev.detail);
    });
    model.listen(async function(state) {
        await store.write(state);
    });
    model.listen(function renderTheme({ settings }) {
        if(settings.color){
            // Convert hex to HSLA if it's a hex color
            const themeColor = settings.color.startsWith('#') ? hexToHsla(settings.color, 1) : settings.color;
            document.documentElement.style.setProperty("--color-theme", themeColor);
            const backgroundColor = offsetHue(themeColor, 30);
            document.documentElement.style.setProperty("--color-background-gradient", backgroundColor);
        }
    })

    // Render the version number in the footer
    document.getElementById('app-version').innerText = APP_VERSION;

   

    model.emit({ type: 'init' });

    timeLoop(1000, () => {
        renderTabTitle(model.state);
    })

    
   
})();

function renderTabTitle({ newEntry = {}, currentTask = {} }) {
    const title = "Timesheet";
    let info = []

    if(newEntry.task) info.push(newEntry.task);

    if(newEntry.start) {
        info.push(formatDurationToStandard({ 
            duration: calcDuration({ start: newEntry.start, end: new Date() }, 'milliseconds') + hoursToMilliseconds(currentTask?.total || 0)
        }));
    }

    document.title = info.length ? `${info.join(' ')} | ${title}` : title;
}

function settings(el, model) {
    const elImport = el.querySelector('#import');
    elImport.addEventListener('submit', function importData(ev) {
        ev.preventDefault();
        model.emit({
            type: 'import',
            data: elImport.elements.data.value
        })
        elImport.elements.data.value = ""
    });

    const elExport = el.querySelector('#export');
    elExport.addEventListener('submit', function importData(ev) {
        ev.preventDefault();
        model.emit({
            type: 'export'
        })
    });

    const elSettings = el.querySelector('#settings');
    elSettings.addEventListener('submit', function importData(ev) {
        ev.preventDefault();
        
        model.emit({
            type: 'updateSettings',
            data: getFormData(elSettings)
        })
    });

    model.listen(function render(state) {
        setFormData(elSettings, state.settings);
        if(state.export) setFormData(elExport, { data: state.export })
    })
}

function getFormData(form) {
    let data = {}
    for(let element of form.elements) {
        if(!(element instanceof HTMLButtonElement)) {
            data[element.name] = element.value;
        }
    }
    return data;
}

function setFormData(form, data) {
    for(let element of form.elements) {
        if(!(element instanceof HTMLButtonElement)) {
            element.value = data[element.name] === undefined ? '' : data[element.name];
        }
    }
}

function importTimewtime(x) {
    const [_, y,m,d,h,mm,s] = x.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/)
    return new Date(y, m - 1, d, h, mm, s);
}
