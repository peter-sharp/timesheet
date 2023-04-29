import getNetIncome from "./utils/getNetIncome.js";
import { allInputsEntered, noInputsEntered, allInputsEnteredExcept } from "./utils/inputsEntered.js"
import timeToDate from "./utils/timeToDate.js";
import timeLoop from "./utils/timeLoop.js";
import calcDuration from "./utils/calcDuration.js";
import round1dp from "./utils/round1dp.js";
import formatPrice from "./utils/formatPrice.js";
import format24hour from "./utils/format24Hour.js";
import emitEvent from "./utils/emitEvent.js";


class Timesheet extends HTMLElement {
    constructor() {
        super();
        //implementation
        
        this.rowTemplate = document.getElementById('entry_row');
        const el = this;
        this.entriesList = el.querySelector('#time_entries');
        const form = el;
        this.prevTasks = form.querySelector(`#prevTasks`);
        this.state = {};
        timeLoop(1000, () => {
            this.renderNewEntryDuration(this.state);
        })
        el.addEventListener("change", function updateSynced(ev) {
            if(ev.target.name == "synced") {
                const input = ev.target
                const row = input.closest('tr');
                emitEvent(el, 'changedEntry', {
                    id: parseInt(row.dataset.id, 10),
                    synced: row.querySelector('[name="synced"]')?.checked,
                })
            }
        });
        el.addEventListener('focusout', function(ev) {
            if (ev.target.nodeName == 'INPUT') {
                const input = ev.target;
                const row = input.closest('tr');

                console.log({ allInputsEnteredExcept: allInputsEnteredExcept(['time_end'], row), index: row.rowIndex})
                if (allInputsEntered(row)) {
                    emitEvent(el, 'changedEntry', {
                        id: parseInt(row.dataset.id, 10),
                        task: row.querySelector('[name="task"]').value,
                        annotation: row.querySelector('[name="annotation"]').value,
                        start: timeToDate(row.querySelector('[name="time_start"]').value),
                        end: timeToDate(row.querySelector('[name="time_end"]').value),
                        synced: row.querySelector('[name="synced"]')?.checked,
                    })
                }  else if(row.dataset.new && noInputsEntered(row)) {
                    emitEvent(el, 'clearNewEntry');
                } else if(row.dataset.new) {
                    const task = row.querySelector('[name="task"]').value;
                    const annotation = row.querySelector('[name="annotation"]').value;
                    const start = row.querySelector('[name="time_start"]').value;
                    const end = row.querySelector('[name="time_end"]').value;
                    emitEvent(el, 'newEntry', {
                        id: parseInt(row.dataset.id, 10),
                        task,
                        annotation,
                        start: start ? timeToDate(start) : null,
                        end: end ? timeToDate(end) : null,
                    });
                } 
            
            }
        });

        el.addEventListener("click", function handleArchiveAction(ev) {
            if(ev.target.nodeName.toLowerCase() == "button") {
                emitEvent(el, ev.target.name + "Entry", {
                    id: parseInt(ev.target.closest('[data-id]').dataset.id, 10)
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
    }

    update(state) {
        this.render(state);
        this.state = state;
    }

    render(state) {
        const el = this;
        const newTask = this.entriesList.querySelector('[data-new="task"]');
        this.renderEntry(newTask, state.newEntry);
        
        const footer = this.entriesList.querySelector('.table-footer')
        
        if (!state.entries.length || this.entriesList.childNodes.length - 2 > state.entries.length) {
            for (const x of [...this.entriesList.childNodes]) {
                if (![newTask,footer].includes(x)) x.remove();
            }
        }
        
        for (const entry of state.entries) {
            let row = this.entriesList.querySelector(`[data-id="${entry.id}"]`);
            if (!row) {
                row = this.newTimeentryRow();
                row.dataset.id = entry.id
                if (newTask.nextElementSibling) {
                    this.entriesList.insertBefore(row, newTask.nextElementSibling);
                } else {
                    this.entriesList.append(row);
                }
            }
            this.renderEntry(row, entry);
            const duration = calcDuration(entry);
            row.querySelector('[name="duration"]').value = duration;
            row.querySelector('[name="synced"]').checked = entry.synced;

          
        }
        this.renderTaskdatalist(state.tasks)
        //TODO make sure in scope of timesheet
        const elDurationTotal = el.querySelector('[name="durationTotal"]');
        elDurationTotal.value = round1dp(state.durationTotal);
        el.querySelector('[name="durationNetIncome"]').value = formatPrice(getNetIncome(state.durationTotal || 0, state.settings.rate || 0, state.settings.tax || 0))
        const elDurationTotalGaps = el.querySelector('[name="durationTotalGaps"]');
        elDurationTotalGaps.value = round1dp(state.durationTotalGaps);
    }

    renderEntry(row, entry) {
        row.querySelector('[name="task"]').value = entry.task || '';
        row.querySelector('[name="annotation"]').value = entry.annotation || '';
        row.querySelector('[name="time_start"]').value = entry.start ? format24hour(entry.start) : '';
        row.querySelector('[name="time_end"]').value = entry.end ? format24hour(entry.end) : '';
    }


     renderTaskdatalist(tasks) {
        this.prevTasks.innerHTML = ''
        for(const task of Array.from(tasks)) {
            const opt = document.createElement('OPTION');
            opt.value = task;
            opt.innerText = task;
            this.prevTasks.append(opt)
        }
    }

    renderNewEntryDuration({ newEntry }) {
        if(!newEntry) return;
        const newTask = this.entriesList.querySelector('[data-new="task"]');
        const {start} = newEntry
        const duration = calcDuration({ start, end: new Date() });
        const elDuration = newTask.querySelector('[name="duration"]'); 
        elDuration.value = duration;
        elDuration.dataset.state = duration > 0 ? "started" : "stopped";
    }


    newTimeentryRow() {
        return this.rowTemplate.content.cloneNode(true).querySelector('tr')
    }

}

window.customElements.define('time-sheet', Timesheet);
