import newtemplateItem from "../utils/newTemplateItem.js";
import emitEvent from "../utils/emitEvent.js";
const template = document.createElement('template');
template.innerHTML = /*html*/`
<task-list></task-list>
<nav class="pagination overflow-x-scroll">
<ol  id="archive_tasks_page_nav"></ol>
</nav>`


const archiveTasksPageNavItem = document.createElement('template');
archiveTasksPageNavItem.innerHTML = /*html*/`
        <li aria-selected="true"><button type="button" data-style="subtle"></button></li>
`



class TaskArchive extends HTMLElement {
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

        this.tasksList = tasksList;
        this.elArchiveTasksNav = elArchiveTasksNav;
    }

    update(state) {
        this.render(state);
        this.state = state;
    }
    
    
    render({ archiveOpen, archivedTasks, archiveBrowserTaskPage = 0, archiveBrowserTaskPageSize = 20 }) {
        if(!archiveOpen) return;
        const { tasksList, elArchiveTasksNav } = this;

        const offset = archiveBrowserTaskPage * archiveBrowserTaskPageSize;
        const lastIndex = Math.min(offset + archiveBrowserTaskPageSize, archivedTasks.length);
        const toRender = [];
        for (let i = offset; i < lastIndex; i += 1) {
            toRender.push(archivedTasks[i]);
        } 
        console.log("tasks", {toRender, archiveBrowserTaskPage, archiveBrowserTaskPageSize})
        tasksList.update({ tasks: toRender })

        const pageCount = Math.ceil(archivedTasks.length / archiveBrowserTaskPageSize);
        const pages = document.createDocumentFragment();
        for (let i = 0; i < pageCount; i += 1) {
            pages.append(this.renderPageNavItem({ pageNo: i, selectedPage: archiveBrowserTaskPage }))
        } 

        elArchiveTasksNav.innerHTML = ""
        elArchiveTasksNav.append(pages)
    }

    renderPageNavItem({ pageNo, selectedPage }) {
        const item = newtemplateItem(archiveTasksPageNavItem)
        item.setAttribute('aria-selected', pageNo == selectedPage )
        item.querySelector("button").innerText = pageNo
        return item
    }
}

window.customElements.define('task-archive', TaskArchive);