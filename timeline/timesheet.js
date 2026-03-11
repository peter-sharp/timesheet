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
import TimesheetDB from "../timesheetDb.js";

const template = document.createElement('template');
template.innerHTML = /*html*/`<div class="wrapper__inner overflow-x-scroll" id=timesheet>
    <div class="padding-inline-start-5">
        <section data-new="entry" class="new-entry-section">
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
    </div>

    <div id="time_entries" class="padding-inline-start-5 timeline-container">
        <!-- Timeline entries will be inserted here -->
    </div>
    <div class="padding-inline-start-5">
        <footer class="timeline-footer">
            <div class="gaps-info">
                <abbr title="Gaps between entries">Gaps</abbr> <time-duration data-durationTotalGaps></time-duration>
            </div>
            <div class="totals-info">
                <output name="durationTotal"></output> <output class="opacity50" name="durationNetIncome"></output>
            </div>
        </footer>
    </div>

<div id="historical_entries" class="padding-inline-start-5">
        <!-- Historical day sections will be appended here -->
    </div>
    <div class="padding-inline-start-5">
        <button type="button" class="load-more-btn" data-load-more>&#x25BC; Load previous day</button>
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

const historicalEntryRow = document.createElement('template');
historicalEntryRow.innerHTML = /*html*/`
<section class="time-entry time-entry-section time-entry--readonly">
    <h3 class="entry-title entry-title--time-line"><time-duration></time-duration><span data-title></span></h3>
    <div class="entry-readonly">
        <span data-time-range></span>
        <span data-task-name></span>
        <span data-annotation class="opacity50"></span>
    </div>
</section>`

const MILLISECONDS_PER_HOUR = 3600000
class Timesheet extends HTMLElement {

    #settings;
    #newEntry;
    #entries;
    #tasks;
    #allTasks;
    #tasksIndex = {};
    #durationTotal;
    #durationTotalGaps;
    #unsubscribe = {};
    #oldestLoadedDate = null;
    #noMoreEntries = false;
    constructor() {
        super();
        this.append(template.content.cloneNode(true));
        const el = this;
        this.entriesList = el.querySelector('#time_entries');
        this.historicalContainer = el.querySelector('#historical_entries');
        this.loadMoreBtn = el.querySelector('[data-load-more]');
        const form = el;
        this.prevTasks = form.querySelector(`#prevTasks`);
        this.state = {};
        timeLoop(1000, () => {
            this.renderNewEntryDuration({ newEntry: this.#newEntry?.value });
        })
        this.task = null;
        const that = this;

        // Load more button handler
        this.loadMoreBtn.addEventListener('click', () => this.loadPreviousDay());
        this.dispatchEvent(new ContextRequestEvent('state', (state, unsubscribe) => {
            this.#settings = state.settings;
            this.#newEntry = state.newEntry;
            this.#entries = state.entries;
            this.#tasks = state.tasks;
            this.#allTasks = state.todaysTasks;
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
            this.#unsubscribe.indexTasks = effect(
                this.indexTasks.bind(this),
                this.#tasks
            );
            this.#unsubscribe.datalist = effect(
                () => this.renderTaskdatalist(this.#allTasks?.value || []),
                this.#allTasks
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

    disconnectedCallback() {
        this.#unsubscribe.signals()
        this.#unsubscribe.state()
        this.#unsubscribe.indexTasks();
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

    getTaskById(exid) {
        return this.#tasksIndex[exid] || null;
    }

    indexTasks() {
        this.#tasksIndex = {};
        for (const task of this.#tasks.value) {
            this.#tasksIndex[task.exid] = task;
        }
        console.log("Indexed tasks", this.#tasksIndex);
    }


    render(state) {
        const el = this;
        const newEntry = el.querySelector('[data-new="entry"]');
        this.renderEntry(newEntry, state.newEntry);
        
        // Clear only the timeline container content
        for (const x of [...this.entriesList.childNodes]) {
            x.remove();
        }
        const entries = state.entries.map(shallowClone);
       
        for (const entry of entries) {
            let section = this.entriesList.querySelector(`[data-id="${entry.id}"]`);
            if (!section) {
                section = this.newTimeentrySection();
                section.dataset.id = entry.id
               
            }


            section = this.renderEntryGap(this.renderEntry(section, entry), entry);
            this.entriesList.prepend(section);
        }
        
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
            const task = this.getTaskById(entry.task);
            titleElement.textContent = task ? `${task.description || task.exid} (${task.exid})` : entry.task;
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
            // Skip blank tasks (no exid, or numeric-only exid with no description)
            if (!task.exid && !task.description) continue;
            if (/^\d{10,}$/.test(String(task.exid)) && !task.description) continue;
            const opt = document.createElement('OPTION');
            opt.value = task.exid;
            const parts = [];
            if (task.exid) parts.push(`#${task.exid}`);
            if (task.description) parts.push(task.description);
            if (task.project) parts.push(`+${task.project}`);
            if (task.client) parts.push(`client:${task.client}`);
            opt.innerText = parts.join(' ');
            this.prevTasks.append(opt)
        }
    }

    renderNewEntryDuration({ newEntry }) {
        if(!newEntry || !newEntry.start) return;
        const newTask = this.querySelector('[data-new="entry"]');
        
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

    async loadPreviousDay() {
        if (this.#noMoreEntries) return;

        this.loadMoreBtn.disabled = true;
        this.loadMoreBtn.textContent = 'Loading...';

        try {
            const db = await TimesheetDB();
            const searchFrom = this.#oldestLoadedDate || new Date();
            const prevDate = await db.getPreviousDayWithEntries(searchFrom);

            if (!prevDate) {
                this.#noMoreEntries = true;
                this.loadMoreBtn.textContent = 'No more entries';
                this.loadMoreBtn.disabled = true;
                return;
            }

            const entries = await db.getEntriesByDay(prevDate);
            const taskExids = [...new Set(entries.map(e => e.task))];
            const tasks = await db.getTasksByExids(taskExids);
            const tasksIndex = tasks.reduce((acc, t) => ({ ...acc, [t.exid]: t }), {});

            this.renderHistoricalDay(prevDate, entries, tasksIndex);
            this.#oldestLoadedDate = prevDate;
        } catch (e) {
            console.error('Failed to load previous day:', e);
        } finally {
            if (!this.#noMoreEntries) {
                this.loadMoreBtn.disabled = false;
                this.loadMoreBtn.textContent = '\u25BC Load previous day';
            }
        }
    }

    renderHistoricalDay(date, entries, tasksIndex) {
        const section = document.createElement('section');
        section.className = 'day-section day-section--historical';
        section.dataset.date = date.toISOString().slice(0, 10);

        // Day header
        const header = document.createElement('h3');
        header.className = 'day-header';
        const dateLabel = document.createElement('span');
        dateLabel.textContent = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        header.appendChild(dateLabel);

        // Calculate day total
        const sorted = [...entries].sort((a, b) => new Date(a.start) - new Date(b.start));
        let dayTotal = 0;
        for (const entry of sorted) {
            if (entry.start && entry.end) {
                dayTotal += calcDuration({ start: new Date(entry.start), end: new Date(entry.end) });
            }
        }
        const totalLabel = document.createElement('span');
        totalLabel.textContent = `${round1dp(dayTotal)}h`;
        header.appendChild(totalLabel);
        section.appendChild(header);

        // Entry list container (timeline style)
        const entryContainer = document.createElement('div');
        entryContainer.className = 'timeline-container padding-inline-start-5';

        // Render entries in reverse chronological order (newest first, matching today's rendering)
        for (const entry of [...sorted].reverse()) {
            const row = historicalEntryRow.content.cloneNode(true).querySelector('section');

            const start = new Date(entry.start);
            const end = new Date(entry.end);
            const duration = entry.start && entry.end ? calcDuration({ start, end }) : 0;
            const hours = duration / 1; // already in hours
            const sectionHeight = Math.max(hours * 2, 4);
            row.style.setProperty('--section-height', `${sectionHeight}em`);

            const timeDuration = row.querySelector('time-duration');
            if (entry.start && entry.end) {
                timeDuration.setAttribute('start', start);
                timeDuration.setAttribute('end', end);
            } else {
                timeDuration.setAttribute('duration', 0);
            }

            const titleEl = row.querySelector('[data-title]');
            const task = tasksIndex[entry.task];
            titleEl.textContent = task ? `${task.description || task.exid} (${task.exid})` : entry.task || '';

            const timeRange = row.querySelector('[data-time-range]');
            timeRange.textContent = `${format24hour(start)} – ${format24hour(end)}`;

            const taskName = row.querySelector('[data-task-name]');
            taskName.textContent = entry.task || '';

            const annotation = row.querySelector('[data-annotation]');
            annotation.textContent = entry.annotation || '';

            entryContainer.appendChild(row);
        }

        section.appendChild(entryContainer);
        this.historicalContainer.appendChild(section);
    }

}

window.customElements.define('time-sheet', Timesheet);
