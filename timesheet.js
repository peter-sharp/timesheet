import getNetIncome from "./utils/getNetIncome.js";
import { allInputsEntered, noInputsEntered, allInputsEnteredExcept } from "./utils/inputsEntered.js"
import timeToDate from "./utils/timeToDate.js";
import timeLoop from "./utils/timeLoop.js";
import calcDuration from "./utils/calcDuration.js";
import round1dp from "./utils/round1dp.js";
import formatPrice from "./utils/formatPrice.js";
import format24hour from "./utils/format24Hour.js";
import emitEvent from "./utils/emitEvent.js";
import shallowClone from "./utils/shallowClone.js";


const template = document.createElement('template');
template.innerHTML = /*html*/`<form class="wrapper__inner overflow-x-scroll" id=timesheet>
<table>
    <thead>
        <tr>
            <th>Task</th>
            <th>Annotation</th>
            <th>Time Start</th>
            <th>Time End</th>
            <th>Duration</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody id="time_entries">
        <tr data-new="task">
            <td><input type="text" name="task" list="prevTasks"></td>
            <td><input type="text" name="annotation"></td>
            <td><input type="time" name="time_start"></td>
            <td><input type="time" name="time_end"></td>
            <td><time-duration class="pulseOpacity"></time-duration></td>
            <td></td>
        </tr>
        <tr class="table-footer">
            <td colspan="4"><abbr title="Gaps between entries">Gaps</abbr> <output name="durationTotalGaps"></output></td>
            <td><output name="durationTotal"></output> <output class="opacity50" name="durationNetIncome"></output></td>
            <td></td>
        </tr>
    </tbody>
</table>

<datalist id="prevTasks"></datalist>
<!-- TODO add hidden button to save data -->

</form>`

const entryRow = document.createElement('template');
entryRow.innerHTML = /*html*/`
<tr class="context-reveal time-entry">
    <td><input type="text" name="task" list="prevTasks"></td>
    <td><input type="text" name="annotation"></td>
    <td><input type="time" name="time_start"></td>
    <td><input type="time" name="time_end"></td>
    <td><time-duration></time-duration></td>
    <td class="context-reveal__item"><button name="delete" type="button" data-style="subtle"><span class="sr-only">Delete</span><svg width=16 height=16><title>delete</title><use href="#icon-close"></use></svg></button></td>
</tr>`

class Timesheet extends HTMLElement {
    constructor() {
        super();
        this.append(template.content.cloneNode(true));
        const el = this;
        this.entriesList = el.querySelector('#time_entries');
        const form = el;
        this.prevTasks = form.querySelector(`#prevTasks`);
        this.state = {};
        timeLoop(1000, () => {
            this.renderNewEntryDuration(this.state);
        })
        this.task = null;
        const that = this;
        el.addEventListener('focusout', function handleNewTimeEntry(ev) {
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
                        end: timeToDate(row.querySelector('[name="time_end"]').value)
                    })
                }  else if(row.dataset.new && noInputsEntered(row)) {
                    emitEvent(el, 'clearNewEntry', {task: that.task});
                } else if(row.dataset.new) {
                    that.task = row.querySelector('[name="task"]').value;
                    const annotation = row.querySelector('[name="annotation"]').value;
                    const start = row.querySelector('[name="time_start"]').value;
                    const end = row.querySelector('[name="time_end"]').value;
                    emitEvent(el, 'newEntry', {
                        id: parseInt(row.dataset.id, 10),
                        task: that.task,
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
        const entries = state.entries.map(shallowClone);
       
        for (const entry of entries) {
            let row = this.entriesList.querySelector(`[data-id="${entry.id}"]`);
            if (!row) {
                row = this.newTimeentryRow();
                row.dataset.id = entry.id
               
            }
            if (newTask.nextElementSibling) {
                this.entriesList.insertBefore(row, newTask.nextElementSibling);
            } else {
                this.entriesList.append(row);
            }
            this.renderEntry(row, entry);
          
            row.querySelector('time-duration').setAttribute('start', entry.start);
            row.querySelector('time-duration').setAttribute('end', entry.end);
          
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
        row.style.setProperty("--gap-color", entry.gap && entry.gap > 0.1 ? "rgba(255, 255, 255, 0.2)" : "transparent");
        row.style.setProperty("--gap-size", entry.gap && entry.gap > 0.1 ? `${entry.gap}em` : 0);

        row.querySelector('[name="task"]').value = entry.task || '';
        row.querySelector('[name="annotation"]').value = entry.annotation || '';
        row.querySelector('[name="time_start"]').value = entry.start ? format24hour(entry.start) : '';
        row.querySelector('[name="time_end"]').value = entry.end ? format24hour(entry.end) : '';
    }


     renderTaskdatalist(tasks) {
        this.prevTasks.innerHTML = ''
        for(const task of Array.from(tasks)) {
            const opt = document.createElement('OPTION');
            opt.value = task.exid;
            opt.innerText = `${task.client ? task.client + ' ' : ''}${task.description || task.exid} `;
            this.prevTasks.append(opt)
        }
    }

    renderNewEntryDuration({ newEntry }) {
        if(!newEntry) return;
        const newTask = this.entriesList.querySelector('[data-new="task"]');
        const {start} = newEntry
    
        const elDuration = newTask.querySelector('time-duration'); 
        console.log(start)
        elDuration.dataset.state = start ? "started" : "stopped";
        if(elDuration.dataset.state == "started") {
            elDuration.setAttribute('start', start);
            elDuration.setAttribute('end', new Date());
        } else {
            elDuration.setAttribute('duration', 0);
        }
       
        
    }


    newTimeentryRow() {
        return entryRow.content.cloneNode(true).querySelector('tr')
    }

}

window.customElements.define('time-sheet', Timesheet);
