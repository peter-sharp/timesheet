timesheet(document.getElementById('time_entries'))



async function timesheet(el) {

    const rowTemplate = document.getElementById('entry_row');
    const taskTotalTemplate = document.getElementById('task_total');
    const entriesList = el;
    const form = el.closest('form');
    const prevTasks = form.querySelector(`#prevTasks`);
    const store = Store(
        'timesheet',
        function hydrate(state) {

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
            entries: [],
            archive: [],
            tasks: new Set()
        }
    );
    const model = Model([
            function updateEntry(state, ev) {
                const { id, type, ...change } = ev
                if ('change' != type) return state;

                if (id) {
                    state.entries = state.entries.map(x => x.id == id ? {...x, ...change } : x)
                } else {
                    state.entries = [
                        ...state.entries,
                        {
                            id: Date.now(),
                            ...change
                        }
                    ];
                }

                state.tasks = new Set([...Array.from(state.tasks), change.task])

                return state;
            },
            function archiveEntries(state, ev) {
                if ('archive' != ev.type) return state;
                state.archive = [...state.archive, ...state.entries.map(shallowClone)];
                state.entries = [];
                return state;
            }
        ],
        await store.read()
    )

    function shallowClone(x) {
        return {...x };
    }


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
                //  model.emit({
                //     type: 'new',
                //     id: parseInt(ev.target.closest('tr').dataset.id, 10),
                //     task: row.querySelector('[name="task"]').value,
                //     annotation: row.querySelector('[name="annotation"]').value,
                //     start: timeToDate(row.querySelector('[name="time_start"]').value),
                //     end: timeToDate(row.querySelector('[name="time_end"]').value),
                // })
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

    form.addEventListener('submit', function archive(ev) {
        ev.preventDefault();
        if (ev.submitter ?.name == 'archive') {
            model.emit({
                type: 'archive'
            })
        }
    });

    model.listen(function render(state) {
        const newTask = entriesList.querySelector('[data-new="task"]');
        newTask.querySelectorAll('input').forEach(x => x.value = '');
        let durationTotal = 0;
        const taskTotals = {};
        if (!state.entries.length) {
            for (const x of [...entriesList.childNodes]) {
                if (x !== newTask) x.remove();
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

            row.querySelector('[name="task"]').value = entry.task;
            row.querySelector('[name="annotation"]').value = entry.annotation;
            row.querySelector('[name="time_start"]').value = format24hour(entry.start);
            row.querySelector('[name="time_end"]').value = format24hour(entry.end);
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
        document.querySelector('[name="durationTotal"]').value = round1dp(durationTotal);
    })

    function renderTaskTotals(totals) {
        const elTotals = document.querySelector('[data-task-totals]')
        elTotals.innerHTML = '';
        for (let [task, total] of Object.entries(totals)) {
            const li = newTasktotalItem();
            li.querySelector('[data-task]').innerText = task;
            li.querySelector('[name="taskTotal"]').value = total;
            elTotals.append(li);
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

    model.listen(store.write);

    model.emit({ type: 'init' });

    function newTimeentryRow() {
        return rowTemplate.content.cloneNode(true).querySelector('tr')
    }

    function newTasktotalItem() {
        return taskTotalTemplate.content.cloneNode(true).querySelector('li')
    }


    function formatDurationDecimal(duration) {
        const HOUR = 60 * 60 * 1000;
        return Math.ceil((duration / HOUR) * 10) / 10
    }

    function round1dp(x) {
        return Math.round(x * 10) / 10
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