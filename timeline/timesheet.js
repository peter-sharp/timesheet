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
import dayRibbon, { exidColor, formatShortDuration, MIN_GAP_MS } from "../utils/dayRibbon.js";
import "./gap-menu.js";

const template = document.createElement('template');
template.innerHTML = /*html*/`<div class="wrapper__inner" id=timesheet>
    <nav class="day-ribbon day-ribbon--sticky" aria-label="Today's entries by time" data-ribbon hidden>
        <div class="day-ribbon__track" data-ribbon-track></div>
        <div class="day-ribbon__ticks" data-ribbon-ticks aria-hidden="true"></div>
    </nav>
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
                    <input id="newTask" type="text" name="task">
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

    <div id="time_entries" class="timeline-container">
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

<!-- TODO add hidden button to save data -->

    <gap-menu></gap-menu>
</div>`

const entrySummary = /*html*/`
    <span class="time-entry__swatch" aria-hidden="true"></span>
    <span class="time-entry__range" data-range></span>
    <span class="time-entry__duration" data-duration></span>
    <span class="time-entry__exid" data-exid></span>
    <span class="time-entry__desc" data-desc></span>`

const entryRow = document.createElement('template');
entryRow.innerHTML = /*html*/`
<details class="time-entry">
    <summary class="time-entry__summary">${entrySummary}</summary>
    <form class="entry-form">
        <div class="input-group">
            <label for="entryStart">Time Start: </label>
            <input id="entryStart" type="time" name="time_start">
        </div>
        <div class="input-group">
            <label for="entryEnd">Time End: </label>
            <input id="entryEnd" type="time" name="time_end">
        </div>
        <div class="input-group input-group--wide">
            <label for="entryTask">Task: </label>
            <input id="entryTask" type="text" name="task">
        </div>
        <div class="input-group input-group--wide">
            <label for="entryAnnotation">Annotation: </label>
            <input id="entryAnnotation" type="text" name="annotation">
        </div>
        <div class="entry-actions">
            <button name="delete" type="button" data-style="subtle"><span class="sr-only">Delete</span><svg width=16 height=16><title>delete</title><use href="#icon-close"></use></svg></button>
        </div>
    </form>
</details>`

const entryRowGap = document.createElement('template');
entryRowGap.innerHTML = /*html*/`
<button type="button" class="gap-text"><span data-gap></span> gap</button>`

const historicalEntryRow = document.createElement('template');
historicalEntryRow.innerHTML = /*html*/`
<div class="time-entry time-entry--readonly">
    <div class="time-entry__summary">${entrySummary}</div>
</div>`

const historicalRibbon = document.createElement('template');
historicalRibbon.innerHTML = /*html*/`
<div class="day-ribbon" aria-hidden="true">
    <div class="day-ribbon__track" data-ribbon-track></div>
    <div class="day-ribbon__ticks" data-ribbon-ticks></div>
</div>`

const MILLISECONDS_PER_HOUR = 3600000
class Timesheet extends HTMLElement {

    #settings;
    #newEntry;
    #entries;
    #tasks;
    #tasksIndex = {};
    #durationTotal;
    #durationTotalGaps;
    #allTasks;
    #historicalDays;
    #noMoreEntries;
    #openIds = new Set();
    #unsubscribe = {};
    constructor() {
        super();
        this.append(template.content.cloneNode(true));
        const el = this;
        this.entriesList = el.querySelector('#time_entries');
        this.historicalContainer = el.querySelector('#historical_entries');
        this.loadMoreBtn = el.querySelector('[data-load-more]');
        this.ribbon = el.querySelector('[data-ribbon]');
        // Mounted outside the ribbon: .day-ribbon__track clips its children and the sticky ribbon's
        // backdrop-filter would become the containing block for a position:fixed popup.
        this.gapMenu = el.querySelector('gap-menu');
        const form = el;
        this.state = {};
        timeLoop(1000, () => {
            this.renderNewEntryDuration({ newEntry: this.#newEntry?.value });
        })
        this.task = null;
        const that = this;

        // Load more button handler
        this.loadMoreBtn.addEventListener('click', () => {
            this.loadMoreBtn.disabled = true;
            this.loadMoreBtn.textContent = 'Loading...';
            emitEvent(this, 'loadPreviousDay', {});
        });
        this.dispatchEvent(new ContextRequestEvent('state', (state, unsubscribe) => {
            this.#settings = state.settings;
            this.#newEntry = state.newEntry;
            this.#entries = state.entries;
            this.#tasks = state.tasks;
            this.#allTasks = state.allTasks;

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

            this.#historicalDays = state.historicalDays;
            this.#noMoreEntries = state.noMoreEntries;

            this.#unsubscribe.historical = effect(
                this.renderHistorical.bind(this),
                this.#historicalDays,
                this.#noMoreEntries
            );

            this.#unsubscribe.state = unsubscribe;
        }, true));

        el.addEventListener('focusout', function handleNewTimeEntry(ev) {
            if (ev.target.nodeName == 'INPUT') {
                const input = ev.target;
                const section = input.closest('[data-id], [data-new]');
                // Inputs outside an entry section (e.g. the gap menu's filter) are not ours to handle
                if (!section) return;

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

        el.addEventListener('toggle', function trackOpenEntries(ev) {
            const details = ev.target;
            if (!details.matches?.('details[data-id]')) return;
            const id = parseInt(details.dataset.id, 10);
            details.open ? that.#openIds.add(id) : that.#openIds.delete(id);
            that.ribbon.querySelector(`[data-segment="${id}"]`)?.classList.toggle('is-open', details.open);
        }, true);

        el.addEventListener("click", function handleTimesheetAction(ev) {
            const gap = ev.target.closest('[data-gap-start]');
            if (gap) {
                ev.stopPropagation();
                that.openGapMenu(gap);
                return;
            }
            const segment = ev.target.closest('[data-segment]');
            if (segment) {
                that.openEntry(parseInt(segment.dataset.segment, 10));
                return;
            }
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
        this.#unsubscribe.signals?.();
        this.#unsubscribe.state?.();
        this.#unsubscribe.indexTasks?.();
        this.#unsubscribe.historical?.();
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
        this.renderEntryInputs(newEntry, state.newEntry);

        // Any state change invalidates the element the open menu is anchored to
        this.gapMenu?.close();

        this.entriesList.replaceChildren();
        state.entries.forEach((entry, i) => {
            const details = entryRow.content.cloneNode(true).querySelector('details');
            details.dataset.id = entry.id;
            details.open = this.#openIds.has(entry.id);
            this.renderEntryInputs(details, entry);
            this.renderSummary(details.querySelector('.time-entry__summary'), entry, (exid) => this.getTaskById(exid));
            this.entriesList.prepend(this.renderEntryGap(details, entry, state.entries[i - 1]));
        });

        this.renderRibbon(this.ribbon, state.entries, (exid) => this.getTaskById(exid), true);

        //TODO make sure in scope of timesheet
        const elDurationTotal = el.querySelector('[name="durationTotal"]');
        elDurationTotal.value = round1dp(state.durationTotal);
        el.querySelector('[name="durationNetIncome"]').value = formatPrice(getNetIncome(state.durationTotal || 0, state.settings.rate || 0, state.settings.tax || 0))
        const elDurationTotalGaps = el.querySelector('[data-durationTotalGaps]');
        elDurationTotalGaps.setAttribute("duration", round1dp(state.durationTotalGaps * MILLISECONDS_PER_HOUR));
    }

    /** Opens an entry's details and brings it into view (used by ribbon segments). */
    openEntry(id) {
        const details = this.entriesList.querySelector(`details[data-id="${id}"]`);
        if (!details) return;
        details.open = true;
        this.#openIds.add(id);
        this.ribbon.querySelector(`[data-segment="${id}"]`)?.classList.add('is-open');
        details.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        details.querySelector('summary').focus({ preventScroll: true });
    }

    renderEntryInputs(section, entry) {
        this.renderEntryInput(section.querySelector('[name="task"]'), entry.id, entry.task);
        this.renderEntryInput(section.querySelector('[name="annotation"]'), entry.id, entry.annotation);
        this.renderEntryInput(section.querySelector('[name="time_start"]'), entry.id, entry.start ? format24hour(entry.start) : '');
        this.renderEntryInput(section.querySelector('[name="time_end"]'), entry.id, entry.end ? format24hour(entry.end) : '');
        return section;
    }

    /** Fills a one-line summary: [start]–[end] [duration] [exid] [description] */
    renderSummary(summary, entry, findTask) {
        const start = entry.start ? new Date(entry.start) : null;
        const end = entry.end ? new Date(entry.end) : null;
        const task = findTask(entry.task);
        summary.querySelector('[data-range]').textContent = `${start ? format24hour(start) : '…'}–${end ? format24hour(end) : '…'}`;
        summary.querySelector('[data-duration]').textContent = start && end ? formatShortDuration(end - start) : '';
        summary.querySelector('[data-exid]').textContent = task?.exid || entry.task || '';
        summary.querySelector('[data-desc]').textContent = [task?.description, entry.annotation].filter(Boolean).join(' · ');
        summary.querySelector('.time-entry__swatch').style.setProperty('--entry-color', exidColor(entry.task));
        return summary;
    }

    /** Lays entries proportionally on a ribbon; interactive ribbons get buttons that open the entry. */
    renderRibbon(ribbon, entries, findTask, interactive = false) {
        const { segments, gaps, ticks } = dayRibbon(entries);
        ribbon.hidden = !segments.length;
        const track = ribbon.querySelector('[data-ribbon-track]');
        const gapNodes = interactive ? gaps.map((gap) => {
            const node = document.createElement('button');
            const label = `Fill ${formatShortDuration(gap.end - gap.start)} gap, ${format24hour(gap.start)}–${format24hour(gap.end)}`;
            node.type = 'button';
            node.className = 'day-ribbon__gap';
            node.style.setProperty('--left', `${gap.left}%`);
            node.style.setProperty('--width', `${gap.width}%`);
            node.dataset.gapStart = gap.start.toISOString();
            node.dataset.gapEnd = gap.end.toISOString();
            node.title = label;
            node.setAttribute('aria-label', label);
            return node;
        }) : [];
        track.replaceChildren(...gapNodes, ...segments.map((segment) => {
            const node = document.createElement(interactive ? 'button' : 'span');
            const task = findTask(segment.task);
            const label = `${format24hour(segment.start)}–${format24hour(segment.end)} ${formatShortDuration(segment.end - segment.start)} ${task?.exid || segment.task || ''} ${task?.description || ''}`.trim();
            node.className = 'day-ribbon__segment';
            node.style.setProperty('--left', `${segment.left}%`);
            node.style.setProperty('--width', `${segment.width}%`);
            node.style.setProperty('--entry-color', exidColor(segment.task));
            node.title = label;
            if (interactive) {
                node.type = 'button';
                node.dataset.segment = segment.id;
                node.setAttribute('aria-label', label);
                node.classList.toggle('is-open', this.#openIds.has(segment.id));
            }
            return node;
        }));
        ribbon.querySelector('[data-ribbon-ticks]').replaceChildren(...ticks.map((tick) => {
            const node = document.createElement('span');
            node.textContent = tick.hour;
            node.style.setProperty('--left', `${tick.left}%`);
            return node;
        }));
        return ribbon;
    }

    renderEntryInput(input, id, value ) {
        if (!input) return;
        const label = input.labels?.[0];
        if(label && id !== undefined) {
            label.setAttribute('for', label.getAttribute('for')?.replace('entry', id));
            input.id = input.id.replace('entry', id);
        }
        input.value = value || '';
        return input;
    }

    /** Renders an entry, followed by the gap that precedes it (the list reads newest-first). */
    renderEntryGap(details, entry, prevEntry) {
        const group = document.createDocumentFragment();
        group.appendChild(details);
        const gapMs = (entry.gap || 0) * MILLISECONDS_PER_HOUR;
        if (gapMs >= MIN_GAP_MS) {
            const gap = entryRowGap.content.cloneNode(true).querySelector('button');
            gap.querySelector('[data-gap]').textContent = formatShortDuration(gapMs);
            const start = prevEntry?.end ? new Date(prevEntry.end) : null;
            const end = entry.start ? new Date(entry.start) : null;
            if (start && end) {
                gap.dataset.gapStart = start.toISOString();
                gap.dataset.gapEnd = end.toISOString();
                gap.setAttribute('aria-label', `Fill ${formatShortDuration(gapMs)} gap, ${format24hour(start)}–${format24hour(end)}`);
            } else {
                gap.disabled = true;
            }
            group.appendChild(gap);
        }
        return group
    }

    /** Opens the task picker for a tapped gap element (ribbon hole or list row). */
    openGapMenu(gapEl) {
        const start = new Date(gapEl.dataset.gapStart);
        const end = new Date(gapEl.dataset.gapEnd);
        if (isNaN(start) || isNaN(end)) return;
        this.gapMenu.tasks = this.gapFillTasks();
        this.gapMenu.open({ start, end, anchor: gapEl });
    }

    /** Today's tasks (most time logged first), then recently used ones; completed tasks last. */
    gapFillTasks() {
        const totals = {};
        for (const entry of this.#entries?.value || []) {
            if (!entry.task || !entry.start || !entry.end) continue;
            totals[entry.task] = (totals[entry.task] || 0) + (new Date(entry.end) - new Date(entry.start));
        }
        const byTotal = (a, b) => (totals[b.exid] || 0) - (totals[a.exid] || 0);
        const byRecency = (a, b) => new Date(b.mostRecentEntry || b.lastModified || 0) - new Date(a.mostRecentEntry || a.lastModified || 0);
        const today = [...(this.#tasks?.value || [])].filter((task) => task.exid).sort(byTotal);
        const recent = [...(this.#allTasks?.value || [])].filter((task) => task.exid).sort(byRecency);

        const seen = new Set();
        const merged = [...today, ...recent].filter((task) => {
            if (seen.has(task.exid) || task.deleted) return false;
            seen.add(task.exid);
            return true;
        });
        // Completed tasks stay reachable through the filter, just not at the top
        return [
            ...merged.filter((task) => task.status !== 'complete'),
            ...merged.filter((task) => task.status === 'complete')
        ];
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


    renderHistorical() {
        const days = this.#historicalDays?.value || [];
        const noMore = this.#noMoreEntries?.value || false;

        // Clear and re-render all historical day sections
        this.historicalContainer.innerHTML = '';
        for (const day of days) {
            const tasksIndex = day.tasks.reduce((acc, t) => ({ ...acc, [t.exid]: t }), {});
            this.renderHistoricalDay(day.date, day.entries, tasksIndex);
        }

        // Update button state
        if (noMore) {
            this.loadMoreBtn.textContent = 'No more entries';
            this.loadMoreBtn.disabled = true;
        } else {
            this.loadMoreBtn.disabled = false;
            this.loadMoreBtn.textContent = '\u25BC Load previous day';
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

        const findTask = (exid) => tasksIndex[exid] || null;
        section.appendChild(this.renderRibbon(historicalRibbon.content.cloneNode(true).querySelector('.day-ribbon'), sorted, findTask));

        // Entry list (newest first, matching today's rendering)
        const entryContainer = document.createElement('div');
        entryContainer.className = 'timeline-container';
        for (const entry of [...sorted].reverse()) {
            const row = historicalEntryRow.content.cloneNode(true).querySelector('.time-entry');
            this.renderSummary(row.querySelector('.time-entry__summary'), entry, findTask);
            entryContainer.appendChild(row);
        }

        section.appendChild(entryContainer);
        this.historicalContainer.appendChild(section);
    }

}

window.customElements.define('time-sheet', Timesheet);
