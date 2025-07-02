import newtemplateItem from "../utils/newTemplateItem.js";
import emitEvent from "../utils/emitEvent.js";
import { ContextRequestEvent } from "../utils/Context.js";
import { effect, signal } from "../utils/Signal.js";

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
    #archiveTasks;
    #archiveBrowserTaskPage;
    #archiveBrowserTaskPageSize;
    #totalPages;
    #archivedTasksSearchTerm = signal("");
    #unsubscribe = {};

    constructor() {
        super();
        console.log("TaskArchive component initialized."); // Log initialization
        this.append(template.content.cloneNode(true));
        const el = this;

        const elArchiveTasksNav = el.querySelector("#archive_tasks_page_nav");
        const tasksList = el.querySelector('#archive_tasks_list');

        elArchiveTasksNav.addEventListener("click", function updatePage(ev) {
            if (ev.target.nodeName.toLowerCase() == "button") {
                console.log("Page navigation clicked:", ev.target.innerText); // Log page navigation
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
                    console.log("State received:", state); // Log state reception
                    this.#archiveTasks = state.archiveTasks;
                    this.#archiveBrowserTaskPage = state.archiveBrowserTaskPage;
                    this.#archiveBrowserTaskPageSize = state.archiveBrowserTaskPageSize;
                    this.#totalPages = state.totalPages; // Retrieve totalPages from context

                    this.#unsubscribe.signals = effect(
                        this.update.bind(this),
                        this.#archiveTasks,
                        this.#archiveBrowserTaskPage,
                        this.#archiveBrowserTaskPageSize,
                        this.#totalPages
                    );

                    this.#unsubscribe.state = unsubscribe;
                },
                true
            )
        );

        this.#unsubscribe.searchTermSignal = this.#archivedTasksSearchTerm.effect(() => {
            console.log("Search term updated:", this.#archivedTasksSearchTerm.value); // Log search term updates
            emitEvent(this, "updateArchiveTasks", {
                searchTerm: this.#archivedTasksSearchTerm.value
            });
        });
    }

    disconnectedCallback() {
        console.log("TaskArchive component disconnected."); // Log disconnection
        this.#unsubscribe.signals();
        this.#unsubscribe.state();
        this.#unsubscribe.searchTermSignal();
    }

    searchArchive(ev) {
        ev.preventDefault();
        const searchTerm = this.searchForm.elements.term.value;
        console.log("Search submitted with term:", searchTerm); // Log search submission
        this.#archivedTasksSearchTerm.value = searchTerm;
    }

    update() {
        console.log("Update triggered."); // Log update trigger
        this.render({
            archiveTasks: this.#archiveTasks?.value || [],
            archiveBrowserTaskPage: this.#archiveBrowserTaskPage?.value || 0,
            archiveBrowserTaskPageSize: this.#archiveBrowserTaskPageSize?.value || 20,
            totalPages: this.#totalPages?.value || 0
        });
    }

    render({ archiveTasks, archiveBrowserTaskPage = 0, archiveBrowserTaskPageSize = 20, totalPages = 0 }) {
        console.log("Render called with:", { archiveTasks, archiveBrowserTaskPage, archiveBrowserTaskPageSize, totalPages }); // Log render parameters
        this.renderTasks(archiveTasks);

        const pages = document.createDocumentFragment();
        for (let i = 0; i < totalPages; i += 1) {
            pages.append(this.renderPageNavItem({ pageNo: i, selectedPage: archiveBrowserTaskPage }));
        }

        this.elArchiveTasksNav.innerHTML = "";
        this.elArchiveTasksNav.append(pages);
    }

    renderTasks(tasks) {
        console.log("Rendering tasks:", tasks); // Log tasks being rendered
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
        const item = document.createElement('li');
        item.setAttribute('aria-selected', pageNo === selectedPage);
        const button = document.createElement('button');
        button.type = 'button';
        button.innerText = pageNo;
        item.append(button);
        return item;
    }
}

window.customElements.define('task-archive', TaskArchive);