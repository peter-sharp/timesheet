(async () => {

    const store = Store(
        'timesheet',
        function hydrate(state) {
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


            state.tasks = new Set(state.tasks);
            
            return state;
        },
        function dehydrate(state) {
            return {...state, tasks: Array.from(state.tasks) };
        }, {
            newEntry: {},
            entries: [],
            archive: [],
            tasks: new Set(),
            settings: {}
        }
    );
    const model = Model([
            function newEntry(state, ev) {
                const { type, ...data } = ev
                if ('new' != type) return state;
              
                state.newEntry = {...data};
                
                return state;
            },
            function updateEntry(state, ev) {
                const { id, type, ...change } = ev
                if ('change' != type) return state;

                if (id) {
                    // updating existing entry
                    state.entries = state.entries.map(x => x.id == id ? {...x, ...change } : x)
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
                }

                state.tasks = new Set([...Array.from(state.tasks), change.task])

                return state;
            },
            function archiveEntries(state, ev) {
                if ('archive' != ev.type) return state;
                state.archive = [...state.archive, ...state.entries.map(shallowClone)];
                state.entries = [];
                const now = new Date()
                function isSameMonth(x) {
                    return x.start.getMonth() == now.getMonth()
                }

                

                const totalDurationMonth = reduce(reduceDuraction, 0, filter(isSameMonth, state.archive))
                const totalNetIncomeMonth = totalDurationMonth * state.settings.rate - percentOf(state.settings.tax, state.settings.rate)
                state.stats = {
                    ...state.stats,
                    totalDurationMonth,
                    totalNetIncomeMonth
                }

                return state;
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



    timesheet(document.getElementById('timesheet'), model);
    archive(document.getElementById('archive'), model);
    settings(document.getElementById('settings'), model);
    timeLoop(1000, () => {
        renderTabTitle(model.state);
    })

    model.listen(store.write);

    model.emit({ type: 'init' });
})();

function timesheet(el, model) {

    const rowTemplate = document.getElementById('entry_row');
    const taskTotalTemplate = document.getElementById('task_total');
    const entriesList = el.querySelector('#time_entries');
    const form = el;
    const prevTasks = form.querySelector(`#prevTasks`);
    
    timeLoop(1000, () => {
        renderNewEntryDuration(model.state);
    })


    el.addEventListener('focusout', function(ev) {
        if (ev.target.nodeName == 'INPUT') {
            const input = ev.target;
            const row = input.closest('tr');
            if (allInputsEntered(row)) {
                 model.emit({
                    type: 'change',
                    id: parseInt(ev.target.closest('tr').dataset.id, 10),
                    task: row.querySelector('[name="task"]').value,
                    annotation: row.querySelector('[name="annotation"]').value,
                    start: timeToDate(row.querySelector('[name="time_start"]').value),
                    end: timeToDate(row.querySelector('[name="time_end"]').value),
                    synced: row.querySelector('[name="synced"]')?.checked,
                })
            } else if(row.dataset.new) {
                const task = row.querySelector('[name="task"]').value;
                const annotation = row.querySelector('[name="annotation"]').value;
                const start = row.querySelector('[name="time_start"]').value;
                const end = row.querySelector('[name="time_end"]').value;
                model.emit({
                    type: 'new',
                    id: parseInt(ev.target.closest('tr').dataset.id, 10),
                    task,
                    annotation,
                    start: start ? timeToDate(start) : null,
                    end: end ? timeToDate(end) : null,
                })
            }
           
        }
    });

    el.addEventListener('focusin', function autofillTime(ev) {
        if (ev.target.nodeName == 'INPUT') {
            const input = ev.target;
            if (input.value || !['time_start', 'time_end'].includes(input.name)) {
                return;
            }

            input.value = format24hour(new Date());
        }
    });


    model.listen(function render(state) {
        const newTask = entriesList.querySelector('[data-new="task"]');
        renderEntry(newTask, state.newEntry);
        
        const footer = entriesList.querySelector('.table-footer')
        let durationTotal = 0;
        const taskTotals = {};
        if (!state.entries.length) {
            for (const x of [...entriesList.childNodes]) {
                if (![newTask,footer].includes(x)) x.remove();
                console.log(x);
            }
        }
        for (const entry of state.entries) {
            let row = entriesList.querySelector(`[data-id="${entry.id}"]`);
            if (!row) {
                row = newTimeentryRow();
                row.dataset.id = entry.id
                if (newTask.nextElementSibling) {
                    entriesList.insertBefore(row, newTask.nextElementSibling);
                } else {
                    entriesList.append(row);
                }
            }

            renderEntry(row, entry);
            const duration = calcDuration(entry);
            row.querySelector('[name="duration"]').value = duration;
            durationTotal += duration;
            row.querySelector('[name="synced"]').checked = entry.synced;
            taskTotals[entry.task] = taskTotals[entry.task] || 0;
            taskTotals[entry.task] += duration;
        }
        renderTaskTotals(taskTotals);
        renderTaskdatalist(state.tasks)
        //TODO make sure in scope of timesheet
        const elDurationTotal = el.querySelector('[name="durationTotal"]')
        elDurationTotal.value = round1dp(durationTotal);
        el.querySelector('[name="durationNetIncome"]').value = formatPrice.format(getNetIncome(durationTotal, state.settings.rate, state.settings.tax))
    })

    function renderEntry(row, entry) {
        row.querySelector('[name="task"]').value = entry.task || '';
        row.querySelector('[name="annotation"]').value = entry.annotation || '';
        row.querySelector('[name="time_start"]').value = entry.start ? format24hour(entry.start) : '';
        row.querySelector('[name="time_end"]').value = entry.end ? format24hour(entry.end) : '';
    }

    function renderTaskTotals(totals) {
        const elTotals = document.querySelector('[data-task-totals]')
        elTotals.innerHTML = '';
        for (let [task, total] of Object.entries(totals)) {
            const item = newTasktotalItem();
            item.querySelector('[data-task]').innerText = task;
            item.querySelector('[name="taskTotal"]').value = total;
            elTotals.append(item);
        }
    }


    function renderTaskdatalist(tasks) {
        prevTasks.innerHTML = ''
        for(const task of Array.from(tasks)) {
            const opt = document.createElement('OPTION');
            opt.value = task;
            opt.innerText = task;
            prevTasks.append(opt)
        }
    }

    function renderNewEntryDuration({ newEntry }) {
        const newTask = entriesList.querySelector('[data-new="task"]');
        const {start} = newEntry
        const duration = calcDuration({ start, end: new Date() });
        const elDuration = newTask.querySelector('[name="duration"]'); 
        elDuration.value = duration;
        elDuration.dataset.state = duration > 0 ? "started" : "stopped";
    }


    function newTimeentryRow() {
        return rowTemplate.content.cloneNode(true).querySelector('tr')
    }

    function newTasktotalItem() {
        return taskTotalTemplate.content.cloneNode(true).querySelector('tr')
    }

    
}


function renderTabTitle({ newEntry }) {
    const title = "Timesheet";
    let info = []

    if(newEntry.task) info.push(newEntry.task);

    if(newEntry.start) info.push(calcDuration({ start: newEntry.start, end: new Date() }));

    document.title = info.length ? `${info.join(' ')} | ${title}` : title;
}

function getNetIncome(duration, rate, tax) {
    return duration * rate - percentOf(tax, rate)
}

function percentOf(percent, number) {
    return percent/100 * number
}



const formatPrice = Intl.NumberFormat("en-US", { style: 'currency', currency: 'USD' })
function archive(el, model) {
    
    el.addEventListener('submit', function archive(ev) {
        ev.preventDefault();
        if (ev.submitter ?.name == 'archive') {
            model.emit({
                type: 'archive'
            })
        }
    });

    model.listen(function renderStats({ stats = {} }) {
        const { totalDurationMonth, totalNetIncomeMonth } = stats;
        el.querySelector('[name="totalDurationMonth"]').value = round1dp(totalDurationMonth);
        el.querySelector('[name="totalNetIncomeMonth"]').value = formatPrice.format(totalNetIncomeMonth);
    })
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
            element.value = data[element.name];
        }
    }
}

function importTimewtime(x) {
    const [_, y,m,d,h,mm,s] = x.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/)
    return new Date(y, m - 1, d, h, mm, s);
}

function allInputsEntered(el) {
    let entered = true;
    for (const input of el.querySelectorAll('input')) {
        if (!input.value) {
            entered = false;
            break;
        }
    }
    return entered;
}

function shallowClone(x) {
    return {...x };
}


function formatDurationDecimal(duration) {
    const HOUR = 60 * 60 * 1000;
    return Math.ceil((duration / HOUR) * 10) / 10
}

function round1dp(x) {
    return Math.round(x * 10) / 10
}

function reduceDuraction(acc, x) {
    return acc + calcDuration(x);
}

function calcDuration({ start, end }) {
    return start && end ? formatDurationDecimal(end.getTime() - start.getTime()) : 0
}

function timeToDate(val) {
    const date = new Date();
    const [hours, mins] = val.split(':')
    date.setHours(hours);
    date.setMinutes(mins);
    return date;
}


function format24hour(date) {
    return padNumber(2, date.getHours()) + ':' + padNumber(2, date.getMinutes());
}

function padNumber(l, n) { return `${n}`.padStart(l, '0'); }

function timeLoop(ms, fn) {
    fn();
    let that = this === window ? {} : this
    that.timeout = setTimeout(timeLoop.bind(that, ms, fn), ms);
    return that
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