import newtemplateItem from "../utils/newTemplateItem.js";
import emitEvent from "../utils/emitEvent.js";
const template = document.createElement('template');
template.innerHTML = /*html*/`
<form class="input-group row">
    <label for="search_archive" class="sr-only">term</label>
    <input type="search" name="term" id="search_archive" class="row__col-2">
    <button type="submit">Search</button>
</form>
<task-list></task-list>
<nav class="pagination overflow-x-scroll">
<ol  id="archive_tasks_page_nav"></ol>
</nav>`


const archiveTasksPageNavItem = document.createElement('template');
archiveTasksPageNavItem.innerHTML = /*html*/`
        <li aria-selected="true"><button type="button" data-style="subtle"></button></li>
`



class TaskArchive extends HTMLElement {
    archivedTasksSearchTerm = ""
    constructor() {
        super();
        this.append(template.content.cloneNode(true));
        const el = this;

        const elArchiveTasksNav = el.querySelector("#archive_tasks_page_nav")
        const tasksList = el.querySelector('task-list');

        
        elArchiveTasksNav.addEventListener("click", function updatePage(ev) {
            if(ev.target.nodeName.toLowerCase() == "button") {
                emitEvent(el, "updateArchiveTaskPage", {
                    page: parseInt(ev.target.innerText, 10)
                })
            }
        });

        this.searchForm = el.querySelector("form");
        this.searchForm.addEventListener("submit", searchArchive);
        function searchArchive(ev) {
            ev.preventDefault();
            this.archivedTasksSearchTerm = el.searchForm.elements.term.value
            el.render({ ...el.state, archivedTasksSearchTerm: this.archivedTasksSearchTerm });
        }

        this.tasksList = tasksList;
        this.elArchiveTasksNav = elArchiveTasksNav;
    }

    update(state) {
        this.render({...state, archivedTasksSearchTerm: this.archivedTasksSearchTerm});
        this.state = state;
    }
    
    
    render({ archiveOpen, archivedTasks, archivedTasksSearchTerm=null, archiveBrowserTaskPage = 0, archiveBrowserTaskPageSize = 20 }) {
        if(!archiveOpen) return;
        const { tasksList, elArchiveTasksNav } = this;
        const filteredTasks = archivedTasksSearchTerm ? archivedTasks.filter(this.filterBySearchTerm(archivedTasksSearchTerm)) : archivedTasks;
        const offset = archiveBrowserTaskPage * archiveBrowserTaskPageSize;
        const lastIndex = Math.min(offset + archiveBrowserTaskPageSize, filteredTasks.length);
        const toRender = [];
        for (let i = offset; i < lastIndex; i += 1) {
            toRender.push(filteredTasks[i]);
        } 
        console.log("tasks", {toRender, archiveBrowserTaskPage, archiveBrowserTaskPageSize})
        tasksList.update({ tasks: toRender })

        const pageCount = Math.ceil(filteredTasks.length / archiveBrowserTaskPageSize);
        const pages = document.createDocumentFragment();
        for (let i = 0; i < pageCount; i += 1) {
            pages.append(this.renderPageNavItem({ pageNo: i, selectedPage: archiveBrowserTaskPage }))
        } 

        elArchiveTasksNav.innerHTML = ""
        elArchiveTasksNav.append(pages)
    }

    filterBySearchTerm(term) {
        return function Search({ exid, description, client}){
            return (exid || '').toString().toLowerCase().includes(term) 
                 || (description|| '').toLowerCase().includes(term) 
                 || (client|| '').toLowerCase().includes(term)
        }
    }

    renderPageNavItem({ pageNo, selectedPage }) {
        const item = newtemplateItem(archiveTasksPageNavItem)
        item.setAttribute('aria-selected', pageNo == selectedPage )
        item.querySelector("button").innerText = pageNo
        return item
    }
}

window.customElements.define('task-archive', TaskArchive);