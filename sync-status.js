import getNetIncome from "./utils/getNetIncome.js";
import calcDuration from "./utils/calcDuration.js";
import round1dp from "./utils/round1dp.js";
import formatPrice from "./utils/formatPrice.js";
import format24hour from "./utils/format24Hour.js";
import emitEvent from "./utils/emitEvent.js";

const timeentires = document.createElement('template');
timeentires.innerHTML = /*html*/`<form class="wrapper__inner">
<table>
    <thead>
        <tr>
            <th>Task</th>
            <th>Annotation</th>
            <th>Time Start</th>
            <th>Time End</th>
            <th>Duration</th>
            <th>Sync</th>
        </tr>
    </thead>
    <tbody data-entries>
        <tr class="table-footer">
            <td colspan="4"><abbr title="Gaps between entries">Gaps</abbr> <output name="durationTotalGaps"></output></td>
            <td><output name="durationTotal"></output> <output class="opacity50" name="durationNetIncome"></output></td>
            <td></td>
        </tr>
    </tbody>
</table>

</form>`

const entryRow = document.createElement('template')
entryRow.innerHTML = /*html*/`<tr>
    <td><output type="text" name="task"></td>
    <td><output type="text" name="annotation"></td>
    <td><output type="time" name="time_start"></td>
    <td><output type="time" name="time_end"></td>
    <td><output name="duration"></output></td>
    <td><input type="checkbox" name="synced"></td>
</tr>`

class SyncStatus extends HTMLElement {
    constructor() {
        super();
        this.append(timeentires.content.cloneNode(true));
        this.entriesList = this.querySelector('[data-entries]');
    }

    connectedCallback() {
        const el = this;
        

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
    }

    
    update(state) {
        this.render(state);
        this.state = state;
    }

    render(state) {
        const el = this;
        const footer = this.entriesList.querySelector('.table-footer')
        
        if (!state.entries.length || this.entriesList.childNodes.length - 1 > state.entries.length) {
            for (const x of [...this.entriesList.childNodes]) {
                if (![footer].includes(x)) x.remove();
            }
        }
        
        for (const entry of state.entries) {
            let row = this.entriesList.querySelector(`[data-id="${entry.id}"]`);
            if (!row) {
                row = this.newTimeentryRow();
                row.dataset.id = entry.id
                this.entriesList.insertBefore(row, footer)
            }
            this.renderEntry(row, entry);
          

          
        }
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
        row.querySelector('[name="synced"]').checked = entry.synced;
        const duration = calcDuration(entry);
        row.querySelector('[name="duration"]').value = duration;
        console.log({ row, entry})
    }



   


    newTimeentryRow() {
        return entryRow.content.cloneNode(true).querySelector('tr')
    }

}

window.customElements.define('sync-status', SyncStatus);