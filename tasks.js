import newtemplateItem from "./utils/newTemplateItem.js";
import emitEvent from "./utils/emitEvent.js";
import sortByMostRecentEntry from "./utils/sortByMostRecentEntry.js";

const template = document.createElement("template");
template.innerHTML = /*html*/`
<form data-new-task>
    <div class="row">
        <div>
            <label for="newTask">Task</label>
            <input id="newTask" type="text" name="taskRaw">
        </div>
        <button type="submit">Add</button>
    </div>
</form>
<div>
   
    <ul data-task-totals class="tasks unstyled-list stack" style="--gap: 1.6em"></ul>
</div>`


const taskRow = document.createElement('template');
taskRow.innerHTML = /*html*/`
<li data-exid="" class="task-item" >
        <input type="checkbox" name="complete" class="task-item__complete">
        <div class="task-item__content">
        <p class="task-item__details">
            <span data-task></span>
            <span data-client></span>
            <output name="taskTotal"></output>
        </p>
        <p class="task-item__description" data-description></p>
        </div>
        <span class="task-item__actions row">
            <label class="task-item__synced-label">Synced <input type="checkbox" name="synced"></label>
            <button name="delete" type="button" data-style="subtle"><span class="sr-only">Delete</span>&times;</button>
            <button name="start" type="button" data-style="subtle"><span class="sr-only" data-label>Start</span><span data-icon>&RightTriangle;</span></button>
            <button name="stop" class="pulseOpacity" data-state="started" hidden type="button" data-style="subtle"><span class="sr-only" data-label>Stop</span><span data-icon>&square;</span></button>
        </span>
</li>`

class TaskList extends HTMLElement {
    constructor() {
        super();
        //implementation
        this.classList.add('stack');
        this.appendChild(newtemplateItem(template));
        this.newTaskForm = this.querySelector('[data-new-task]');
        this.elTotals = this.querySelector('[data-task-totals]');

        const that = this;
        this.newTaskForm.addEventListener("submit", function addTask(ev){
            ev.preventDefault();
            const elTaskRaw = ev.target.elements.taskRaw
            emitEvent(that, "addTask", {
                raw: elTaskRaw.value
            });
            elTaskRaw.value = ""
        });

        this.addEventListener("change", function toggleTaskSynced(ev) {
            switch (ev.target.name) {
                case 'synced':
                    emitEvent(that, "taskSyncChanged", {
                        exid: ev.target.closest('li').querySelector('[data-task]').innerText,
                        synced: ev.target.checked
                    })
                    break;
                case 'complete':
                    emitEvent(that, "taskComplete", {
                        exid: ev.target.closest('li').querySelector('[data-task]').innerText,
                        complete: ev.target.checked
                    })
                    break;
            }
        });

        this.addEventListener("click", function handleArchiveAction(ev) {
            if(ev.target.closest("button")) {
                const btn = ev.target.closest("button")
                emitEvent(that, btn.name + "Task", {
                    exid: btn.closest('[data-exid]').dataset.exid
                });
                return false;
            }
        });

        
    }

  

    update(state) {
        this.renderTasks(state);
    }

    renderTasks({ tasks = [] }) {
        const elTotals = this.elTotals;
        elTotals.innerHTML = '';
        let toRender = tasks.filter(x => x.exid);

        toRender = toRender.sort(sortByMostRecentEntry);

        for (let {exid, client= "", timingState="stop", description="", total = 0, synced = false, complete = false} of toRender) {
            
            const item = newtemplateItem(taskRow);
            item.dataset.exid = exid
            item.querySelector('[name="complete"]').checked = complete
            item.querySelector('[data-task]').innerText = exid;
            item.querySelector('[data-client]').innerText = client;
            const elDesc = item.querySelector('[data-description]');
            elDesc.innerText = description;
            if(description.length == 0) elDesc.remove();
            item.querySelector('[name="taskTotal"]').value = total;
            item.querySelector('[name="synced"]').checked = synced

            item.querySelector('[name="start"]').hidden = "start" == timingState
            item.querySelector('[name="stop"]').hidden =  "stop" == timingState

            elTotals.append(item);
        }
    }

}

window.customElements.define('task-list', TaskList);
