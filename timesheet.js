import getNetIncome from "./utils/getNetIncome.js";
import {ContextRequestEvent} from './utils/Context.js';
import {effect} from './utils/Signal.js';
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
        <tr data-new="entry">
            <td><input type="text" name="task" list="prevTasks"></td>
            <td><input type="text" name="annotation"></td>
            <td><input type="time" name="time_start"></td>
            <td><input type="time" name="time_end"></td>
            <td><time-duration class="pulseOpacity"></time-duration></td>
            <td></td>
        </tr>
        <tr class="table-footer">
            <td colspan="4"><abbr title="Gaps between entries">Gaps</abbr> <time-duration data-durationTotalGaps></time-duration></td>
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

const entryRowGap = document.createElement('template');
entryRowGap.innerHTML = /*html*/`
<tr class="context-reveal time-entry row-gap">
    <td colspan="6"><time-duration data-gap></time-duration></td>
</tr>`

const MILLISECONDS_PER_HOUR = 3600000
class Timesheet extends HTMLElement {

    #settings;
    #newEntry;
    #entries;
    #tasks;
    #durationTotal;
    #durationTotalGaps;
    #unsubscribe = {};
    constructor() {
        super();
        this.append(template.content.cloneNode(true));
        const el = this;
        this.entriesList = el.querySelector('#time_entries');
        const form = el;
        this.prevTasks = form.querySelector(`#prevTasks`);
        this.state = {};
        timeLoop(1000, () => {
            this.renderNewEntryDuration({ newEntry: this.#newEntry?.value });
        })
        this.task = null;
        const that = this;
        this.dispatchEvent(new ContextRequestEvent('state', (state, unsubscribe) => {
            this.#settings = state.settings;
            this.#newEntry = state.newEntry;
            this.#entries = state.entries;
            this.#tasks = state.tasks;
            this.#durationTotal = state.durationTotal;
            this.#durationTotalGaps = state.durationTotalGaps;

            this.#unsubscribe.signals = effect(
                this.update.bind(this),
                this.#settings,
                this.#newEntry,
                this.#entries,
                this.#tasks,
                this.#durationTotal,
                this.#durationTotalGaps
            );
            this.#unsubscribe.state = unsubscribe;
        }, true));

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

        el.addEventListener("click", function handleTimesheetAction(ev) {
           
            if(ev.target.closest("button")) {
                const btn = ev.target.closest("button");
                emitEvent(el, btn.name + "Entry", {
                    id: parseInt(btn.closest('[data-id]').dataset.id, 10)
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

    diconnectedCallback() {
        this.#unsubscribe.signals()
        this.#unsubscribe.state()
    }

    update() {
        this.render({
            settings: this.#settings.value,
            newEntry: this.#newEntry.value,
            entries: this.#entries.value,
            tasks: this.#tasks.value,
            durationTotal: this.#durationTotal.value,
            durationTotalGaps: this.#durationTotalGaps.value
        });
 
    }

    render(state) {
        const el = this;
        const newEntry = this.entriesList.querySelector('[data-new="entry"]');
        this.renderEntry(newEntry, state.newEntry);
        
        const footer = this.entriesList.querySelector('.table-footer')
        
  
        for (const x of [...this.entriesList.childNodes]) {
            if (![newEntry,footer].includes(x)) x.remove();
        }
        const entries = state.entries.map(shallowClone);
       
        for (const entry of entries) {
            let row = this.entriesList.querySelector(`[data-id="${entry.id}"]`);
            if (!row) {
                row = this.newTimeentryRow();
                row.dataset.id = entry.id
               
            }

        
            row = this.renderEntryGap(this.renderEntry(row, entry), entry);
            if(newEntry) {
                newEntry.after(row);
            } else {
                this.entriesList.append(row)
            }
             
           
           
          
        }
        this.renderTaskdatalist(state.tasks)
        //TODO make sure in scope of timesheet
        const elDurationTotal = el.querySelector('[name="durationTotal"]');
        elDurationTotal.value = round1dp(state.durationTotal);
        el.querySelector('[name="durationNetIncome"]').value = formatPrice(getNetIncome(state.durationTotal || 0, state.settings.rate || 0, state.settings.tax || 0))
        const elDurationTotalGaps = el.querySelector('[data-durationTotalGaps]');
        elDurationTotalGaps.setAttribute("duration", round1dp(state.durationTotalGaps * MILLISECONDS_PER_HOUR));
    }

    renderEntry(row, entry) {
       
        row.querySelector('[name="task"]').value = entry.task || '';
        row.querySelector('[name="annotation"]').value = entry.annotation || '';
        row.querySelector('[name="time_start"]').value = entry.start ? format24hour(entry.start) : '';
        row.querySelector('[name="time_end"]').value = entry.end ? format24hour(entry.end) : '';
        if(entry.start && entry.end) {
            row.querySelector('time-duration').setAttribute('end', entry.end);
            row.querySelector('time-duration').setAttribute('start', entry.start);
        } else {
            row.querySelector('time-duration').setAttribute('duration', 0);
        }
    
        return row
    }

    renderEntryGap(row, entry) {
        const rowGroup = document.createDocumentFragment();
       
        
        rowGroup.appendChild(row);

        if(entry.gap && entry.gap > 0.05 ) {
            const gapRow = entryRowGap.content.cloneNode(true).querySelector('tr');
            gapRow.querySelector('time-duration').setAttribute('duration', entry.gap * MILLISECONDS_PER_HOUR);
            gapRow.style.setProperty("--gap-color", "rgba(255, 255, 255, 0.2)" );
            gapRow.style.setProperty("--gap-size",  `${entry.gap + 1}em` );
            rowGroup.appendChild(gapRow);
        }
        return rowGroup
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
        if(!newEntry || !newEntry.start) return;
        const newTask = this.entriesList.querySelector('[data-new="entry"]');
        
        const {start} = newEntry
    
        const elDuration = newTask.querySelector('time-duration'); 

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
