import { Model } from "./model.js";
import  "./timesheet.js";
import  "./tasks.js";
import  "./hash-router.js";
import  "./hash-nav.js";
import  "./sync-status.js";
import timeLoop from "./utils/timeLoop.js";
import calcDuration from "./utils/calcDuration.js";
import round1dp from "./utils/round1dp.js";
import formatPrice from "./utils/formatPrice.js";
import percentOf from "./utils/percentOf.js";
import format24hour from "./utils/format24Hour.js";
import newtemplateItem from "./utils/newTemplateItem.js";
import first from "./utils/first.js";
import last from "./utils/last.js";
import store from "./timesheetStore.js";

(async () => {

    if('serviceWorker' in navigator) {
        try {
            console.log('CLIENT: registering service worker.');
            await navigator.serviceWorker.register('./serviceWorker.js');
            console.log('CLIENT: service worker registration complete.');
        } catch(e) {
            console.error(e);
        }
    }

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
            
            function archiveEntries(state, ev) {
                switch (ev.type) {
                    case 'archive':
                        state.archive = [...state.entries.map(shallowClone), ...state.archive];
                        state.archive.sort(function byStartTimeDesc(a,b){
                            if(a.start > b.start) return -1;
                            if(a.start < b.start) return 1;
                            return 0;
                        });
                        state.archivedTasks = [...state.tasks.map(shallowClone), ...(state.archivedTasks || [])];
                        state.tasks = [];
                        state.entries = [];
                        break;
                
                    case 'archiveState':
                        state.archiveOpen = ev.state;
                        break;
                    case 'updateArchivePage':
                        state.archiveBrowserPage = ev.page
                        break;
                    case 'deleteArchiveEntry':
                        const archive = [];
                        state.deleted = state.deleted || [];
                        for (const x of state.archive) {
                            if(x.id == ev.id) state.deleted.push(x)
                            else archive.push(x)
                        }
                        state.archive = archive
                        break;
                }
                
                return state;
            },
            function archiveTotals(state, ev) {
                if(!ev.type.toLowerCase().includes('archive')) return state;
                const now = new Date()
                const lastMonth = subMonth(now, 1);
                const lastWeek = subWeek(now, 1);

                const isCurrentWeek = (x) => isSameWeek(now, x.start);
                const isLastWeek = (x) => isSameWeek(lastWeek, x.start);

                function isSameMonth(date, x) {
                    return x.start.getMonth() == date.getMonth()
                }

                const totalDurationWeek = reduce(reduceDuration, 0, filter(isCurrentWeek, state.archive))
                const totalNetIncomeWeek = totalDurationWeek * (state.settings.rate || 0) - percentOf(state.settings.tax || 0, state.settings.rate || 0)

                const totalDurationLastWeek = reduce(reduceDuration, 0, filter(isLastWeek, state.archive))
                const totalNetIncomeLastWeek = totalDurationLastWeek * (state.settings.rate || 0) - percentOf(state.settings.tax || 0, state.settings.rate || 0)

                const totalDurationMonth = reduce(reduceDuration, 0, filter(apply(isSameMonth, now), state.archive))
                const totalNetIncomeMonth = totalDurationMonth * (state.settings.rate || 0) - percentOf(state.settings.tax || 0, state.settings.rate || 0)
                const totalDurationLastMonth = reduce(reduceDuration, 0, filter(apply(isSameMonth, lastMonth), state.archive))
                const totalNetIncomeLastMonth = totalDurationLastMonth * (state.settings.rate || 0) - percentOf(state.settings.tax || 0, state.settings.rate || 0)
                state.stats = {
                    ...state.stats,
                    totalDurationWeek,
                    totalNetIncomeWeek,
                    totalDurationLastWeek,
                    totalNetIncomeLastWeek,
                    totalDurationMonth,
                    totalNetIncomeMonth,
                    totalDurationLastMonth,
                    totalNetIncomeLastMonth
                };
                console.log(state.stats)
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
                        state.currentTask = {};
                        state.tasks = state.tasks.map(x => x.exid == ev.exid ? {...x, timingState: "stop"} : x);
                        break;
                    case "addTask":
                        const [exid, client, description] = extract([/#(\w+)/, /client:(\w+)/], ev.raw);
                        // mostRecentEntry to ensure new tasks are at the top
                        state.tasks = [...state.tasks, { exid, client, description, id: Date.now(), mostRecentEntry: new Date()}]
                        break;
                    case "taskSyncChanged":
                        state.tasks = state.tasks.map(x => x.exid == ev.exid ? {...x, synced: ev.synced} : x);
                        state.entries = state.entries.map(x => x.task == ev.exid ? {...x, synced: ev.synced} : x);
                        break;
                    case "taskComplete":
                        state.tasks = state.tasks.map(x => x.exid == ev.exid ? {...x, complete: ev.complete} : x);
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
        
                            taskTotals[entry.task] = taskTotals[entry.task] || { task: entry.task, total: 0, mostRecentEntry: new Date(0,0,0), synced: true };
                            taskTotals[entry.task].total += calcDuration(entry);
                            if(!entry.synced) taskTotals[entry.task].synced = false;
                            if(entry.start > taskTotals[entry.task].mostRecentEntry) taskTotals[entry.task].mostRecentEntry = entry.start;
                        }
                        // state.taskTotals = Object.entries(taskTotals).map(([task, stats]) => ({task, ...stats}));
                        let tasks = [];
                        const oldTasks = state.tasks.map(x => x.exid ? x : { exid: x })
                        if(oldTasks.length >= Object.keys(taskTotals).length) {
                            for (const task of oldTasks) {
                                tasks.push({...task, ...(taskTotals[task.exid] || {})});
                            }
                        } else {
                            const tasksByExid = oldTasks.reduce((xs, x) => ({...xs, [x.exid]: x}), {})
                            for (const [exid, stats] of Object.entries(taskTotals)) {
                                tasks.push({...(tasksByExid[exid] || {}), ...stats, exid});
                            }
                        }

                        
                        // merging values
                        const tasksByExid = tasks.reduce((xs, x) => ({...xs, [x.exid]: {...(xs[x.exid] || []), ...x}}), {});
                        tasks = Object.values(tasksByExid)
                       
                        state.tasks = tasks;
                        break;
                }
                return state
            },
            function settings(state, ev) {
                switch (ev.type) {
                    case 'import':
                        const data = JSON.parse(ev.data);
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
                        state.archive = [...state.archive, ...imported]
                        break;
                    case "export":
                        state.export = JSON.stringify([...state.archive, ...state.entries])
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
    )

    
    const timeSheet = document.querySelector('time-sheet');
    model.listen(timeSheet.update.bind(timeSheet));

    const tasksList = document.querySelector('#tasks task-list');
    model.listen(tasksList.update.bind(tasksList));

    const syncStatus = document.querySelector('sync-status');
    model.listen(syncStatus.update.bind(syncStatus));


    archive(document.getElementById('archive'), model);
    settings(document.getElementById('settings'), model);
    timeLoop(1000, () => {
        renderTabTitle(model.state);
    })

    // TODO make web component
    const outputCurrentTask = document.querySelector('output[name="currentTask"]')
    timeLoop(1000, () => {
        renderCurrentTask(outputCurrentTask, model.state);
    })

    document.body.addEventListener("updateState", function updateState(ev) {
        model.emit(ev.detail);
    });
    model.listen(store.write);
    model.listen(function renderTheme({ settings }) {
        if(settings.color){
            document.body.style.setProperty("--theme-color", settings.color);
        }
    })

    model.emit({ type: 'init' });
})();

function extract(regs, x) {
    let res = []
    let str = x
    for (const reg of regs) {
        let [rawItem, item] = str.match(reg) || [];
        str = str.replace(rawItem, '');
        res.push(item);
    }
    res.push(str);
    return res
}


function renderTabTitle({ newEntry, currentTask }) {
    const title = "Timesheet";
    let info = []

    if(newEntry.task) info.push(newEntry.task);

    if(newEntry.start) info.push(calcDuration({ start: newEntry.start, end: new Date() }) + (currentTask?.total || 0));

    document.title = info.length ? `${info.join(' ')} | ${title}` : title;
}

function renderCurrentTask(outputCurrentTask, { newEntry, currentTask }) {
   
    let info = []

    if(newEntry.task) info.push(newEntry.task);

    if(newEntry.start) info.push(calcDuration({ start: newEntry.start, end: new Date() }) + (currentTask?.total || 0));

    outputCurrentTask.value = info.length ? info.join(' ') : '';
}


let formatDate = new Intl.DateTimeFormat('en-US');
formatDate = formatDate.format.bind(formatDate);
function archive(el, model) {
    const archiveEntryRow = document.getElementById('archive_entry_row');
    const archiveEntriesPageNavItem = document.getElementById('archive_entries_page_nav_item');
    const elDetails = el
    const elArchiveForm = el.querySelector('form[name="archive"]')

    elArchiveForm.addEventListener('submit', function archive(ev) {
        ev.preventDefault();
        if (ev.submitter ?.name == 'archive') {
            model.emit({
                type: 'archive'
            })
        }
    });

    elDetails.addEventListener('toggle', function updateArchiveActiveState(){
        model.emit({
            type: 'archiveState',
            state: elDetails.open
        })
    })

    model.listen(function renderStats({ stats = {} }) {
        const { 
            totalDurationWeek = 0, 
            totalNetIncomeWeek = 0,
            totalDurationLastWeek = 0,
            totalNetIncomeLastWeek = 0,
            totalDurationMonth = 0, 
            totalNetIncomeMonth = 0,
            totalDurationLastMonth = 0, 
            totalNetIncomeLastMonth = 0
        } = stats;
        el.querySelector('[name="totalDurationWeek"]').value = round1dp(totalDurationWeek);
        el.querySelector('[name="totalNetIncomeWeek"]').value = formatPrice(totalNetIncomeWeek);
        el.querySelector('[name="totalDurationLastWeek"]').value = round1dp(totalDurationLastWeek);
        el.querySelector('[name="totalNetIncomeLastWeek"]').value = formatPrice(totalNetIncomeLastWeek);
        el.querySelector('[name="totalDurationMonth"]').value = round1dp(totalDurationMonth);
        el.querySelector('[name="totalNetIncomeMonth"]').value = formatPrice(totalNetIncomeMonth);
        el.querySelector('[name="totalDurationLastMonth"]').value = round1dp(totalDurationLastMonth);
        el.querySelector('[name="totalNetIncomeLastMonth"]').value = formatPrice(totalNetIncomeLastMonth);
    })

    const elArchiveEntries = el.querySelector("#archive_entries")
    const elArchiveEntriesNav = el.querySelector("#archive_entries_page_nav")
    
    elArchiveEntries.addEventListener("click", function handleArchiveAction(ev) {
        if(ev.target.nodeName.toLowerCase() == "button") {
            model.emit({
                type: ev.target.name + "ArchiveEntry",
                id: parseInt(ev.target.closest('[data-id]').dataset.id, 10)
            })
        }
    });

    elArchiveEntriesNav.addEventListener("click", function updatePage(ev) {
        if(ev.target.nodeName.toLowerCase() == "button") {
            model.emit({
                type: "updateArchivePage",
                page: parseInt(ev.target.innerText, 10)
            })
        }
    });

    model.listen(function renderArchiveBrowser({ archiveOpen, archive, archiveBrowserPage = 0, archiveBrowserPageSize = 20 }) {
        if(!archiveOpen) return;
        
        const rows = document.createDocumentFragment();
        const offset = archiveBrowserPage * archiveBrowserPageSize;
        const lastIndex = Math.min(offset + archiveBrowserPageSize, archive.length);
        for (let i = offset; i < lastIndex; i += 1) {
            rows.append(renderEntry(archive[i]))
        } 

        elArchiveEntries.innerHTML = "";
        elArchiveEntries.append(rows);

        const pageCount = Math.ceil(archive.length / archiveBrowserPageSize);
        const pages = document.createDocumentFragment();
        for (let i = 0; i < pageCount; i += 1) {
            pages.append(renderPageNavItem({ pageNo: i, selectedPage: archiveBrowserPage }))
        } 

        elArchiveEntriesNav.innerHTML = ""
        elArchiveEntriesNav.append(pages)
    })

    function renderEntry( entry) {
        const row = newtemplateItem(archiveEntryRow)
        row.dataset.id = entry.id
        row.querySelector('[data-field="task"]').innerText = entry.task || '';
        row.querySelector('[data-field="annotation"]').innerText = entry.annotation || '';
        row.querySelector('[data-field="date_start"]').innerText = entry.start ? formatDate(entry.start) : '';
        row.querySelector('[data-field="time_start"]').innerText = entry.start ? format24hour(entry.start) : '';
        row.querySelector('[data-field="time_end"]').innerText = entry.end ? format24hour(entry.end) : '';
        const duration = calcDuration(entry);
        row.querySelector('[data-field="duration"]').innerText = duration;
        row.querySelector('[data-field="synced"]').innerText = entry.synced ? "yes" : "no";
        return row
    }

    function renderPageNavItem({ pageNo, selectedPage }) {
        const item = newtemplateItem(archiveEntriesPageNavItem)
        item.setAttribute('aria-selected', pageNo == selectedPage )
        item.querySelector("button").innerText = pageNo
        return item
    }

    const tasksList = el.querySelector('task-list');
    model.listen(({ archivedTasks }) => tasksList.update({ tasks: archivedTasks }));
}


function settings(el, model) {
    const elImport = el.querySelector('#import');
    elImport.addEventListener('submit', function importData(ev) {
        ev.preventDefault();
        model.emit({
            type: 'import',
            data: elImport.elements.data.value
        })
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



function shallowClone(x) {
    return {...x };
}



function reduceDuration(acc, x) {
    return acc + calcDuration(x);
}


function *filter(fn, xs) {
    for(let x of xs) {
        if(fn(x)) yield x;
    }
}

function reduce(fn, acc, xs) {
    for(let x of xs) {
        acc = fn(acc, x)
    }
    return acc;
}



function isSameWeek(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000; // one day in milliseconds
    const dayOfWeek = date1.getDay(); // get the day of the week of the first date
    const firstDayOfWeek = new Date(date1.getTime() - dayOfWeek * oneDay); // get the first day of the week
    const lastDayOfWeek = new Date(firstDayOfWeek.getTime() + 6 * oneDay); // get the last day of the week

    // check if the second date is between the first and last day of the week
    return date2 >= firstDayOfWeek && date2 <= lastDayOfWeek;
}

function subMonth(date, months) {
    const newDate = new Date(date)
     newDate.setMonth( date.getMonth() - months);
     return newDate
 }

 function subWeek(date, weeks) {
    const oneDay = 24 * 60 * 60 * 1000; // one day in milliseconds
    const oneWeek = oneDay * 7;
    const newDate = new Date(date.getTime() - oneWeek * weeks);
     return newDate
 }

function apply(fn, ...args) {
    return fn.bind(null, ...args)
}