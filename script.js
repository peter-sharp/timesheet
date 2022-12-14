const WEEK = 7 * 24 * 3600 * 1000;

timesheet(document.getElementById('time_entries'))



async function timesheet(el) {

    const rowTemplate = document.getElementById('entry_row');
    const taskTotalTemplate = document.getElementById('task_total');

    

    const store = Store(
        'timesheet',
        function hydrate(state) {
            state.selectedWeek = state.selectedWeek || weekOfYear(new Date)
            state.selectedWeek = parseInt(state.selectedWeek, 10)
            console.log(state)
            state.entries = state.entries.map(
                ({ start, end, ...x }) => ({
                    start: new Date(start),
                    end: new Date(end),
                    ...x
                })
            ).filter(x => weekOfYear(x.start) == state.selectedWeek);
            console.log(state)
            return state;
        },
        {
            selectedWeek: weekOfYear(new Date),
            entries: []
        }
    );
    const model = Model([
        function updateEntry(state, ev) {
            const { id, type, ...change } = ev
            if ('change' != type) return state;

            if (id) {
                state.entries = state.entries.map(x => x.id == id ? { ...x, ...change } : x)
            } else {
                state.entries = [
                    ...state.entries,
                    {
                        id: Date.now(),
                        ...change
                    }
                ];
            }
            return state;
        },
    ],
        await store.read()
    )


    el.addEventListener('focusout', function (ev) {
        if (ev.target.nodeName == 'INPUT') {
            const input = ev.target;
            const row = input.closest('tr');
            if (!allInputsEntered(row)) return;

            model.emit({
                type: 'change',
                id: parseInt(ev.target.closest('tr').id, 10),
                task: row.querySelector('[name="task"]').value,
                start: timeToDate(row.querySelector('[name="time_start"]').value),
                end: timeToDate(row.querySelector('[name="time_end"]').value),
            })
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
        const newTask = el.querySelector('[data-new="task"]');
        newTask.querySelectorAll('input').forEach(x => x.value = '');
        let durationTotal = 0;
        const taskTotals = {};
        for (const entry of state.entries) {
            let row = document.getElementById(entry.id);
            if (!row) {
                row = newTimeentryRow();
                row.id = entry.id
                if (newTask.nextElementSibling) {
                    el.insertBefore(row, newTask.nextElementSibling);
                } else {
                    el.append(row);
                }
            }

            row.querySelector('[name="task"]').value = entry.task;
            row.querySelector('[name="time_start"]').value = format24hour(entry.start);
            row.querySelector('[name="time_end"]').value = format24hour(entry.end);
            const duration = calcDuration(entry);
            row.querySelector('[name="duration"]').value = duration;
            durationTotal += duration;
            taskTotals[entry.task] = taskTotals[entry.task] || 0;
            taskTotals[entry.task] += duration;
        }
        renderTaskTotals(taskTotals);

        //TODO make sure in scope of timesheet
        document.querySelector('[name="durationTotal"]').value = round1dp(durationTotal);
    })

    function renderTaskTotals(totals) {
        const elTotals = document.querySelector('[data-task-totals]')
        elTotals.innerHTML = '';
        for( let [task, total] of Object.entries(totals)) {
            const li = newTasktotalItem();
            li.querySelector('[data-task]').innerText = task;
            li.querySelector('[name="taskTotal"]').value = total;
            elTotals.append(li);
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

function weekNav(el) {
    const model = Model(
        [],
        {
            currWeek: new Date(),
        }
    );
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

function dateAdd(ms, date) {
    return new Date(date.getTime() + ms);
}

function isSameWeek(dateA, dateB) {
    return weekOfYear(dateA) == weekOfYear(dateB)
}

function weekOfYear(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    startOfYear.setDate(startOfYear.getDate() + (startOfYear.getDay() % 7))
    return Math.round((date - startOfYear) / WEEK)
}
