import newtemplateItem from "../utils/newTemplateItem.js";
import emitEvent from "../utils/emitEvent.js";
import sortByMostRecentEntry from "../utils/sortByMostRecentEntry.js";

const template = document.createElement("template");
template.innerHTML = /*html*/ `
<div>
   
    <ul data-task-totals class="tasks unstyled-list stack" style="--gap: 1.6em"></ul>
</div>`;



const taskRow = document.createElement("template");
taskRow.innerHTML = /*html*/ `
<li data-exid="" class="task-item" >
        <input type="checkbox" name="complete" class="task-item__complete" disabled>
        <div class="task-item__content">
        <p class="task-item__details">
            <span data-task></span>
            <span data-client></span>
            <output name="taskTotal"></output>
        </p>
        <p class="task-item__description" data-description></p>
        </div>
        <span class="task-item__actions row"  data-actions>
            <label class="task-item__synced-label">Synced <input type="checkbox" name="synced"></label>
            
        </span>
</li>`;

class TaskSyncStatusList extends HTMLElement {
  constructor() {
    super();
    //implementation
    this.classList.add("stack");

    this.appendChild(newtemplateItem(template));
    this.elTotals = this.querySelector("[data-task-totals]");

    const that = this;
   

    
    this.addEventListener("change", function toggleTaskSynced(ev) {
      switch (ev.target.name) {
        case "synced":
          emitEvent(that, "taskSyncChanged", {
            exid: ev.target.closest("li").querySelector("[data-task]")
              .innerText,
            synced: ev.target.checked,
          });
          break;
        
      }
    });

  }

  update(state) {
    this.renderTasks(state);
    this.state = state;
  }

  renderTasks({ tasks = [] }) {
    const elTotals = this.elTotals;
    elTotals.innerHTML = "";
    let toRender = tasks.filter((x) => x.exid);

    toRender = toRender.sort(sortByMostRecentEntry);

    for (let {
      exid,
      client = "",
      timingState = "stop",
      description = "",
      total = 0,
      synced = false,
      complete = false,
    } of toRender) {
      const item = newtemplateItem(taskRow);
      item.dataset.exid = exid;
      item.querySelector('[name="complete"]').checked = complete;
      item.querySelector("[data-task]").innerText = exid;
      item.querySelector("[data-client]").innerText = client;
      const elDesc = item.querySelector("[data-description]");
      elDesc.innerText = description;
      if (description.length == 0) elDesc.remove();
    
      
        item.querySelector('[name="synced"]').checked = synced;
        
        item.querySelector('[name="taskTotal"]').value = total;
      elTotals.append(item);
    }
  }

}

window.customElements.define("tasksyncstatus-list", TaskSyncStatusList);
