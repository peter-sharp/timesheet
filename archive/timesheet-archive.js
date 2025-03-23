import newtemplateItem from "../utils/newTemplateItem.js";
import formatDate from "../utils/formatDate.js";
import format24hour from "../utils/format24Hour.js";
import calcDuration from "../utils/calcDuration.js";
import emitEvent from "../utils/emitEvent.js";

const template = document.createElement('template');
template.innerHTML = /*html*/`
<table>
<thead>
    <tr>
        <th>Task</th>
        <th>Annotation</th>
        <th>Date</th>
        <th>Time Start</th>
        <th>Time End</th>
        <th>Duration</th>
        <th>Synced</th>
        <th>Actions</th>
    </tr>
</thead>
<tbody id="archive_entries">
</tbody>
</table>
<nav class="pagination overflow-x-scroll">
<ol  id="archive_entries_page_nav"></ol>
</nav>`

const archiveEntryRow = document.createElement('template');
archiveEntryRow.innerHTML = /*html*/`
        <tr data-id="">
            <td data-field="task"></td>
            <td data-field="annotation"></td>
            <td data-field="date_start" title="date started"></td>
            <td data-field="time_start"></td>
            <td data-field="time_end"></td>
            <td data-field="duration"></td>
            <td><span class="cb-state" data-field="synced"></span></td>
            <td><button name="delete" type="button" data-style="subtle"><span class="sr-only">Delete</span>&times;</button></td>
        </tr>
`
const archiveEntriesPageNavItem = document.createElement('template');
archiveEntriesPageNavItem.innerHTML = /*html*/`
        <li aria-selected="true"><button type="button" data-style="subtle"></button></li>
`



class TimesheetArchive extends HTMLElement {
    constructor() {
        super();
        this.append(template.content.cloneNode(true));
        const el = this;

        const elArchiveEntries = el.querySelector("#archive_entries")
        const elArchiveEntriesNav = el.querySelector("#archive_entries_page_nav")
        
        elArchiveEntries.addEventListener("click", function handleArchiveAction(ev) {
            if(ev.target.nodeName.toLowerCase() == "button") {
                emitEvent(el, ev.target.name + "ArchiveEntry", {
                    id: parseInt(ev.target.closest('[data-id]').dataset.id, 10)
                })
            }
        });
    
        elArchiveEntriesNav.addEventListener("click", function updatePage(ev) {
            if(ev.target.nodeName.toLowerCase() == "button") {
                emitEvent(el, "updateArchivePage", {
                    page: parseInt(ev.target.innerText, 10)
                })
            }
        });

        this.elArchiveEntries = elArchiveEntries;
        this.elArchiveEntriesNav = elArchiveEntriesNav;
    }

    update(state) {
        this.render(state);
        this.state = state;
    }

    render({ archiveOpen, archive, archiveBrowserPage = 0, archiveBrowserPageSize = 20 }) {
        if(!archiveOpen) return;
        const { elArchiveEntries, elArchiveEntriesNav } = this;

        const entries = archive.entries || [];
        const rows = document.createDocumentFragment();
        const offset = archiveBrowserPage * archiveBrowserPageSize;
        const lastIndex = Math.min(offset + archiveBrowserPageSize, entries.length);
        for (let i = offset; i < lastIndex; i += 1) {
            rows.append(this.renderEntry(entries[i]))
        } 

        elArchiveEntries.innerHTML = "";
        elArchiveEntries.append(rows);

        const pageCount = Math.ceil(entries.length / archiveBrowserPageSize);
        const pages = document.createDocumentFragment();
        for (let i = 0; i < pageCount; i += 1) {
            pages.append(this.renderPageNavItem({ pageNo: i, selectedPage: archiveBrowserPage }))
        } 

        elArchiveEntriesNav.innerHTML = ""
        elArchiveEntriesNav.append(pages)
    }

    renderEntry( entry) {
        const row = newtemplateItem(archiveEntryRow)
        row.dataset.id = entry.id
        row.querySelector('[data-field="task"]').innerText = entry.task || '';
        row.querySelector('[data-field="annotation"]').innerText = entry.annotation || '';
        row.querySelector('[data-field="date_start"]').innerText = entry.start ? formatDate(entry.start) : '';
        row.querySelector('[data-field="time_start"]').innerText = entry.start ? format24hour(entry.start) : '';
        row.querySelector('[data-field="time_end"]').innerText = entry.end ? format24hour(entry.end) : '';
        row.querySelector('[data-field="duration"]').innerText =  calcDuration(entry);
        row.querySelector('[data-field="synced"]').innerText = entry.synced ? "yes" : "no";
        return row
    }

    renderPageNavItem({ pageNo, selectedPage }) {
        const item = newtemplateItem(archiveEntriesPageNavItem)
        item.setAttribute('aria-selected', pageNo == selectedPage )
        item.querySelector("button").innerText = pageNo
        return item
    }

}

window.customElements.define('timesheet-archive', TimesheetArchive);