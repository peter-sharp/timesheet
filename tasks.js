import newtemplateItem from "./utils/newTemplateItem.js";
import emitEvent from "./utils/emitEvent.js";

const template = document.createElement("template");
template.innerHTML = `<table>
<thead>
    <tr>
        <th>task</th>
        <th>duration</th>
        <th>Synced</th>
    </tr>
</thead>
<tbody data-task-totals></tbody>
</table>`


class TaskList extends HTMLElement {
    constructor() {
        super();
        //implementation
        this.appendChild(newtemplateItem(template));
        this.elTotals = this.querySelector('[data-task-totals]');
        this.taskTotalTemplate = document.getElementById('task_total');
        const that = this;
        this.addEventListener("change", function toggleTaskSynced(ev) {
            if(ev.target.name == "synced") {
                emitEvent(that, "taskSyncChanged", {
                    task: ev.target.closest('tr').querySelector('[data-task]').innerText,
                    synced: ev.target.checked
                })
            }
        });
    }

  

    update(state) {
        this.renderTaskTotals(state);
    }

    renderTaskTotals({ taskTotals = [] }) {
        const elTotals = this.elTotals;
        elTotals.innerHTML = '';
        for (let {task, total = 0, synced = false} of taskTotals) {
            const item = newtemplateItem(this.taskTotalTemplate);
            item.querySelector('[data-task]').innerText = task;
            item.querySelector('[name="taskTotal"]').value = total;
            item.querySelector('[name="synced"]').checked = synced
            elTotals.append(item);
        }
    }

}

window.customElements.define('task-list', TaskList);
