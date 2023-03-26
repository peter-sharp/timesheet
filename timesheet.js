import getNetIncome from "./utils/getNetIncome.js";
import { allInputsEntered, noInputsEntered, allInputsEnteredExcept } from "./utils/inputsEntered.js"
import timeToDate from "./utils/timeToDate.js";
import timeLoop from "./utils/timeLoop.js";
import calcDuration from "./utils/calcDuration.js";
import round1dp from "./utils/round1dp.js";
import formatPrice from "./utils/formatPrice.js";
export default function timesheet(el, model) {

    const rowTemplate = document.getElementById('entry_row');
    
    const entriesList = el.querySelector('#time_entries');
    const form = el;
    const prevTasks = form.querySelector(`#prevTasks`);
    
    timeLoop(1000, () => {
        renderNewEntryDuration(model.state);
    })

    el.addEventListener("change", function updateSynced(ev) {
        if(ev.target.name == "synced") {
            const input = ev.target
            const row = input.closest('tr');
            model.emit({
                type: 'changedEntry',
                id: parseInt(row.dataset.id, 10),
                synced: row.querySelector('[name="synced"]')?.checked,
            })
        }
    });
    el.addEventListener('focusout', function(ev) {
        if (ev.target.nodeName == 'INPUT') {
            const input = ev.target;
            const row = input.closest('tr');
            if (allInputsEntered(row)) {
                 model.emit({
                    type: 'changedEntry',
                    id: parseInt(row.dataset.id, 10),
                    task: row.querySelector('[name="task"]').value,
                    annotation: row.querySelector('[name="annotation"]').value,
                    start: timeToDate(row.querySelector('[name="time_start"]').value),
                    end: timeToDate(row.querySelector('[name="time_end"]').value),
                    synced: row.querySelector('[name="synced"]')?.checked,
                })
            } else if (allInputsEnteredExcept(['time_end'], row) && row.rowIndex === 2) {
                 model.emit({
                    type: 'changedEntry',
                    id: parseInt(row.dataset.id, 10),
                    task: row.querySelector('[name="task"]').value,
                    annotation: row.querySelector('[name="annotation"]').value,
                    start: timeToDate(row.querySelector('[name="time_start"]').value),
                    end: null,
                    synced: row.querySelector('[name="synced"]')?.checked,
                })
            } else if(row.dataset.new && noInputsEntered(row)) {
                model.emit({
                    type: 'clearNewEntry'
                })
            } else if(row.dataset.new) {
                const task = row.querySelector('[name="task"]').value;
                const annotation = row.querySelector('[name="annotation"]').value;
                const start = row.querySelector('[name="time_start"]').value;
                const end = row.querySelector('[name="time_end"]').value;
                model.emit({
                    type: 'newEntry',
                    id: parseInt(row.dataset.id, 10),
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
        if (!state.entries.length) {
            for (const x of [...entriesList.childNodes]) {
                if (![newTask,footer].includes(x)) x.remove();
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
            row.querySelector('[name="synced"]').checked = entry.synced;

          
        }
        
        renderTaskdatalist(state.tasks)
        //TODO make sure in scope of timesheet
        const elDurationTotal = el.querySelector('[name="durationTotal"]')
        elDurationTotal.value = round1dp(state.durationTotal);
        el.querySelector('[name="durationNetIncome"]').value = formatPrice(getNetIncome(state.durationTotal || 0, state.settings.rate || 0, state.settings.tax || 0))
    })

    function renderEntry(row, entry) {
        row.querySelector('[name="task"]').value = entry.task || '';
        row.querySelector('[name="annotation"]').value = entry.annotation || '';
        row.querySelector('[name="time_start"]').value = entry.start ? format24hour(entry.start) : '';
        row.querySelector('[name="time_end"]').value = entry.end ? format24hour(entry.end) : '';
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

   

    
}