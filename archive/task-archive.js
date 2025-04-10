import newtemplateItem from "../utils/newTemplateItem.js";
import emitEvent from "../utils/emitEvent.js";
import { ContextRequestEvent } from "../utils/Context.js";
import { effect } from "../utils/Signal.js";

const template = document.createElement('template');
template.innerHTML = /*html*/`
<form class="input-group row">
    <label for="search_archive" class="sr-only">term</label>
    <input type="search" name="term" id="search_archive" class="row__col-2">
    <button type="submit">Search</button>
</form>
<ul id="archive_tasks_list" class="unstyled-list stack"></ul>
<nav class="pagination overflow-x-scroll">
<ol  id="archive_tasks_page_nav"></ol>
</nav>`;

const archiveTasksPageNavItem = document.createElement('template');
archiveTasksPageNavItem.innerHTML = /*html*/`
        <li aria-selected="true"><button type="button" data-style="subtle"></button></li>`;

const archiveTaskItem = document.createElement('template');
archiveTaskItem.innerHTML = /*html*/`
<li data-exid="" class="task-item context-reveal">
    <task-status class="task-item__complete">
        <input type="checkbox" name="complete" disabled>
    </task-status>
    <div class="task-item__content">
        <p class="task-item__details">
            <span data-task></span>
            <span data-client></span>
        </p>
        <p class="task-item__description" data-description></p>
    </div>
</li>`;

class TaskArchive extends HTMLElement {
    #archive;
    #archiveOpen;
    #archiveBrowserTaskPage;
    #archiveBrowserTaskPageSize;
    #unsubscribe = {};
    archivedTasksSearchTerm = "";

    constructor() {
        super();
        this.append(template.content.cloneNode(true));
        const el = this;

        const elArchiveTasksNav = el.querySelector("#archive_tasks_page_nav");
        const tasksList = el.querySelector('#archive_tasks_list');

        elArchiveTasksNav.addEventListener("click", function updatePage(ev) {
            if (ev.target.nodeName.toLowerCase() == "button") {
                emitEvent(el, "updateArchiveTaskPage", {
                    page: parseInt(ev.target.innerText, 10)
                });
            }
        });

        this.searchForm = el.querySelector("form");
        this.searchForm.addEventListener("submit", this.searchArchive.bind(this));

        this.tasksList = tasksList;
        this.elArchiveTasksNav = elArchiveTasksNav;

        this.dispatchEvent(
            new ContextRequestEvent(
                "state",
                (state, unsubscribe) => {
                    this.#archive = state.archive;
                    this.#archiveOpen = state.archiveOpen;
                    this.#archiveBrowserTaskPage = state.archiveBrowserTaskPage;
                    this.#archiveBrowserTaskPageSize = state.archiveBrowserTaskPageSize;

                    this.#unsubscribe.signals = effect(
                        this.update.bind(this),
                        this.#archive,
                        this.#archiveOpen,
                        this.#archiveBrowserTaskPage,
                        this.#archiveBrowserTaskPageSize
                    );

                    this.#unsubscribe.state = unsubscribe;
                },
                true
            )
        );
    }

    disconnectedCallback() {
        this.#unsubscribe.signals();
        this.#unsubscribe.state();
    }

    searchArchive(ev) {
        ev.preventDefault();
        this.archivedTasksSearchTerm = this.searchForm.elements.term.value;
        this.update();
    }

    update() {
        this.render({
            archiveOpen: this.#archiveOpen?.value,
            archive: this.#archive?.value || { tasks: [] },
            archiveBrowserTaskPage: this.#archiveBrowserTaskPage?.value || 0,
            archiveBrowserTaskPageSize: this.#archiveBrowserTaskPageSize?.value || 20,
            archivedTasksSearchTerm: this.archivedTasksSearchTerm
        });
    }

    render({ archiveOpen, archive, archivedTasksSearchTerm = null, archiveBrowserTaskPage = 0, archiveBrowserTaskPageSize = 20 }) {
        if (!archiveOpen) return;
        const { elArchiveTasksNav } = this;
        const filteredTasks = archivedTasksSearchTerm ? archive.tasks.filter(this.filterBySearchTerm(archivedTasksSearchTerm)) : archive.tasks;
        const offset = archiveBrowserTaskPage * archiveBrowserTaskPageSize;
        const lastIndex = Math.min(offset + archiveBrowserTaskPageSize, filteredTasks.length);
        const toRender = [];
        for (let i = offset; i < lastIndex; i += 1) {
            toRender.push(filteredTasks[i]);
        }
        this.renderTasks(toRender);

        const pageCount = Math.ceil(filteredTasks.length / archiveBrowserTaskPageSize);
        const pages = document.createDocumentFragment();
        for (let i = 0; i < pageCount; i += 1) {
            pages.append(this.renderPageNavItem({ pageNo: i, selectedPage: archiveBrowserTaskPage }));
        }

        elArchiveTasksNav.innerHTML = "";
        elArchiveTasksNav.append(pages);
    }

    filterBySearchTerm(term) {
        return function Search({ exid, description, client }) {
            return (exid || '').toString().toLowerCase().includes(term)
                || (description || '').toLowerCase().includes(term)
                || (client || '').toLowerCase().includes(term);
        };
    }

    renderTasks(tasks) {
        const tasksList = this.tasksList;
        tasksList.innerHTML = "";
        tasks.forEach(task => {
            const item = newtemplateItem(archiveTaskItem);
            item.dataset.exid = task.exid;
            item.querySelector("[data-task]").innerText = task.exid;
            item.querySelector("[data-client]").innerText = task.client;
            const elDesc = item.querySelector("[data-description]");
            elDesc.innerText = task.description;
            elDesc.hidden = !task.description?.length;
            item.querySelector("task-status input").checked = task.complete;
            tasksList.append(item);
        });
    }

    renderPageNavItem({ pageNo, selectedPage }) {
        const item = newtemplateItem(archiveTasksPageNavItem);
        item.setAttribute('aria-selected', pageNo == selectedPage);
        item.querySelector("button").innerText = pageNo;
        return item;
    }
}

window.customElements.define('task-archive', TaskArchive);