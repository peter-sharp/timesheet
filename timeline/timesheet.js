import getNetIncome from "../utils/getNetIncome.js";
import {ContextRequestEvent} from '../utils/Context.js';
import {effect} from '../utils/Signal.js';
import { allInputsEntered, noInputsEntered, allInputsEnteredExcept } from "../utils/inputsEntered.js"
import timeToDate from "../utils/timeToDate.js";
import timeLoop from "../utils/timeLoop.js";
import calcDuration from "../utils/calcDuration.js";
import round1dp from "../utils/round1dp.js";
import formatPrice from "../utils/formatPrice.js";
import format24hour from "../utils/format24Hour.js";
import emitEvent from "../utils/emitEvent.js";
import shallowClone from "../utils/shallowClone.js";

const template = document.createElement('template');
template.innerHTML = /*html*/`<div class="wrapper__inner overflow-x-scroll" id=timesheet>
<div id="time_entries" class="timeline-container">
    <section data-new="entry" class="time-entry-section">
        <h3 class="entry-title"><time-duration class="pulseOpacity"></time-duration><span>New Entry</span></h3>
        <form class="entry-form">
            <div class="input-group">
                <label for="newEnd">Time End: </label>
                <input id="newEnd" type="time" name="time_end">
            </div>
            <div class="input-group">
                <label for="newTask">Task: </label>
                <input id="newTask" type="text" name="task" list="prevTasks">
            </div>
             <div class="input-group">
                <label for="newStart">Time Start: </label>
                <input id="newStart" type="time" name="time_start">
            </div>
            
            <div class="input-group">
                <label for="newAnnotation">Annotation: </label>
                <input id="newAnnotation" type="text" name="annotation">
            </div>
           
          
          
        </form>
    </section>
    <section class="timeline-footer">
        <div class="gaps-info">
            <abbr title="Gaps between entries">Gaps</abbr> <time-duration data-durationTotalGaps></time-duration>
        </div>
        <div class="totals-info">
            <output name="durationTotal"></output> <output class="opacity50" name="durationNetIncome"></output>
        </div>
    </section>
</div>

<datalist id="prevTasks"></datalist>
<!-- TODO add hidden button to save data -->

</div>`

const entryRow = document.createElement('template');
entryRow.innerHTML = /*html*/`
<section class="context-reveal time-entry time-entry-section">
    <h3 class="entry-title entry-title--time-line"><time-duration></time-duration><span data-title></span></h3>
    <form class="entry-form">
         <div class="input-group">
            <label for="entryEnd">Time End: </label>
            <input id="entryEnd" type="time" name="time_end" class="context-reveal__input">
        </div>
        <div class="input-group">
            <label for="entryTask">Task: </label>
            <input id="entryTask" type="text" name="task" class="context-reveal__input" list="prevTasks">
        </div>
        <div class="input-group">
            <label for="entryStart">Time Start: </label>
            <input id="entryStart" type="time" name="time_start" class="context-reveal__input">
        </div>
        <div class="input-group">
            <label for="entryAnnotation">Annotation: </label>
            <input id="entryAnnotation" type="text" name="annotation" class="context-reveal__input">
        </div>
        
       
       
        <div class="entry-actions context-reveal__item">
            <button name="delete" type="button" data-style="subtle"><span class="sr-only">Delete</span><svg width=16 height=16><title>delete</title><use href="#icon-close"></use></svg></button>
        </div>
    </form>
</section>`

const entryRowGap = document.createElement('template');
entryRowGap.innerHTML = /*html*/`
<section class="gap-section">
    <p class="gap-text"><time-duration data-gap></time-duration><span>gap</span></p>
</section>`

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
                const section = input.closest('section');

                console.log({ allInputsEnteredExcept: allInputsEnteredExcept(['time_end'], section), section: section})
                if (allInputsEntered(section)) {
                    emitEvent(el, 'changedEntry', {
                        id: parseInt(section.dataset.id, 10),
                        task: section.querySelector('[name="task"]').value,
                        annotation: section.querySelector('[name="annotation"]').value,
                        start: timeToDate(section.querySelector('[name="time_start"]').value),
                        end: timeToDate(section.querySelector('[name="time_end"]').value)
                    })
                }  else if(section.dataset.new && noInputsEntered(section)) {
                    emitEvent(el, 'clearNewEntry', {task: that.task});
                } else if(section.dataset.new) {
                    that.task = section.querySelector('[name="task"]').value;
                    const annotation = section.querySelector('[name="annotation"]').value;
                    const start = section.querySelector('[name="time_start"]').value;
                    const end = section.querySelector('[name="time_end"]').value;
                    emitEvent(el, 'newEntry', {
                        id: parseInt(section.dataset.id, 10),
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
        
        const footer = this.entriesList.querySelector('.timeline-footer')
        
  
        for (const x of [...this.entriesList.childNodes]) {
            if (![newEntry,footer].includes(x)) x.remove();
        }
        const entries = state.entries.map(shallowClone);
       
        for (const entry of entries) {
            let section = this.entriesList.querySelector(`[data-id="${entry.id}"]`);
            if (!section) {
                section = this.newTimeentrySection();
                section.dataset.id = entry.id
               
            }

        
            section = this.renderEntryGap(this.renderEntry(section, entry), entry);
            if(newEntry) {
                newEntry.after(section);
            } else {
                this.entriesList.append(section)
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

    renderEntry(section, entry) {

        this.renderEntryInput(section.querySelector('[name="task"]'), entry.id, entry.task);
        this.renderEntryInput(section.querySelector('[name="annotation"]'), entry.id, entry.annotation);
        this.renderEntryInput(section.querySelector('[name="time_start"]'), entry.id, entry.start ? format24hour(entry.start) : '');
        this.renderEntryInput(section.querySelector('[name="time_end"]'), entry.id, entry.end ? format24hour(entry.end) : '');
       
        
        // Update section title with task name
        const titleElement = section.querySelector('.entry-title > span[data-title]');
        if (titleElement && entry.task) {
            titleElement.textContent = entry.task;
        }
        
        // Calculate duration and set section size
        let duration = 0;
        const timeDurationElement = section.querySelector('time-duration');
        if(entry.start && entry.end) {
            timeDurationElement.setAttribute('end', entry.end);
            timeDurationElement.setAttribute('start', entry.start);
            duration = calcDuration(entry.start, entry.end);
        } else {
            timeDurationElement.setAttribute('duration', 0);
        }
        
        // Set section height based on duration (2em per hour, minimum 4em)
        const hours = duration / MILLISECONDS_PER_HOUR;
        const sectionHeight = Math.max(hours * 2, 4);
        section.style.setProperty('--section-height', `${sectionHeight}em`);
    
        return section
    }

    renderEntryInput(input, id, value ) {
        if (!input) return;
        const label = input.labels[0] || input.previousElementSibling.matches('label') ? input.previousElementSibling : null;
        if(label) {
            label.setAttribute('for', label.getAttribute('for')?.replace('entry', id));
            input.id = input.id.replace('entry', id);
            console.log(input.id, label.getAttribute('for'), id);
        }
       
        input.value = value || '';
        
        return input;

    }

    renderEntryGap(section, entry) {
        const sectionGroup = document.createDocumentFragment();
       
        
        sectionGroup.appendChild(section);

        if(entry.gap && entry.gap > 0.05 ) {
            const gapSection = entryRowGap.content.cloneNode(true).querySelector('section');
            gapSection.querySelector('time-duration').setAttribute('duration', entry.gap * MILLISECONDS_PER_HOUR);
            gapSection.style.setProperty("--gap-color", "rgba(255, 255, 255, 0.2)" );
            gapSection.style.setProperty("--gap-size",  `${entry.gap + 1}em` );
            sectionGroup.appendChild(gapSection);
        }
        return sectionGroup
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


    newTimeentrySection() {
        return entryRow.content.cloneNode(true).querySelector('section')
    }

}

window.customElements.define('time-sheet', Timesheet);
