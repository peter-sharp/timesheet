import newtemplateItem from "./utils/newTemplateItem.js";
import emitEvent from "./utils/emitEvent.js";

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
    <!-- <thead>
        <tr>
            <th>complete</th>
            <th>task</th>
            <th>client</th>
            <th>description</th>
            <th>duration</th>
            <th>Synced</th>
            <th>Actions</th>
        </tr>
    </thead> -->
    <ul data-task-totals class="unstyled-list stack" style="--gap: 1.6em"></ul>
</div>`


const taskRow = document.createElement('template');
taskRow.innerHTML = /*html*/`
<li data-exid="" class="task-item" >
    <div class="task-item__details row">
            <span data-task></span>
            <output name="client"></output>
            <output name="taskTotal"></output>
    </div>
    <div class="row" style="--align: center">
        <input type="checkbox" name="complete">
        <div class="task-item__description"><output name="description"></output></div>
        <span class="task-item__actions row">
            <label class="task-item__synced-label">Synced <input type="checkbox" name="synced"></label>
            <button name="delete" type="button" data-style="subtle"><span class="sr-only">Delete</span>&times;</button>
            <button name="start" type="button" data-style="subtle"><span class="sr-only" data-label>Start</span><span data-icon>&RightTriangle;</span></button>
            <button name="stop" hidden type="button" data-style="subtle"><span class="sr-only" data-label>Stop</span><span data-icon>&square;</span></button>
        </span>
    </div>
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
        const toRender = tasks.filter(x => x.exid);
        for (let {exid, client= "", timingState="stop", description="", total = 0, synced = false, complete = false} of toRender) {
            console.log({exid,
                complete,
                exid,
                client,
                description,
                total,
                synced})
            const item = newtemplateItem(taskRow);
            item.dataset.exid = exid
            item.querySelector('[name="complete"]').checked = complete
            item.querySelector('[data-task]').innerText = exid;
            item.querySelector('[name="client"]').value = client;
            item.querySelector('[name="description"]').value = description;
            item.querySelector('[name="taskTotal"]').value = total;
            item.querySelector('[name="synced"]').checked = synced

            item.querySelector('[name="start"]').hidden = "start" == timingState
            item.querySelector('[name="stop"]').hidden =  "stop" == timingState

            elTotals.append(item);
        }
    }

}

window.customElements.define('task-list', TaskList);
