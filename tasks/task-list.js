import "./task-status.js";
import newtemplateItem from "../utils/newTemplateItem.js";

import { ContextRequestEvent } from "../utils/Context.js";
import { effect } from "../utils/Signal.js";
import emitEvent from "../utils/emitEvent.js";
import sortByMostRecentEntry from "../utils/sortByMostRecentEntry.js";
import timeLoop from "../utils/timeLoop.js";
import calcDuration, {
  formatDurationDecimal,
  hoursToMilliseconds,
} from "../utils/calcDuration.js";
import { playTripleBeep } from "../media.js";
import formatPrice from "../utils/formatPrice.js";
import getNetIncome from "../utils/getNetIncome.js";

const template = document.createElement("template");
template.innerHTML = /*html*/ `
<div>
   
    <ul data-task-totals class="tasks unstyled-list stack" style="--gap: 1.6em"></ul>
    <section class="border-top-1 text-align-right">
            <span><time-duration data-duration-total></time-duration> <output class="opacity50" name="durationNetIncome"></output></span>
    </section>
</div>`;

const taskForm = document.createElement("template");
taskForm.innerHTML = /*html*/ `
<form data-new-task class="margin-bottom-2">
    <div class="row">
        <div class="input-group row__col-2">
            <label for="newTask">Task</label>
            <input id="newTask" type="text" name="taskRaw" list="prev-tasks">
        </div>
        <button type="submit">Add</button>
    </div>
    <details >
      <summary>More info</summary>
      <div class="row">
        <div class="input-group">
            <label for="newTask">ID</label>
            <input id="newTask" type="text" name="exid">
        </div>
        <div class="input-group">
            <label for="newTask">client</label>
            <input id="newTask" type="text" name="client" list="prev-clients">
        </div>
      </div>
      <datalist id="prev-clients"></datalist>
    </details>
    <datalist id="prev-tasks"></datalist>
</form>`;

const taskRow = document.createElement("template");
taskRow.innerHTML = /*html*/ `
<li data-exid="" class="task-item context-reveal" >
        <task-status class="task-item__complete">
          <input type="checkbox" name="complete" >
        </task-status>
        <div class="task-item__content">
        <p class="task-item__details">
            <span data-task></span>
            <span data-client></span>
            
        </p>
        <p class="task-item__description" data-description></p>
        
        </div>
        <span class="row task-item__time"><time-duration data-task-total></time-duration></span>
        <span class="task-item__actions row context-reveal__item" hidden="hidden" data-actions>
            <button name="delete" type="button" data-style="subtle"><span class="sr-only">Delete</span><svg width=16 height=16><title>delete</title><use href="#icon-close"></use></svg></button>
            <button name="start" type="button" data-style="subtle"><span class="sr-only" data-label>Start</span><svg width=16 height=16><title>play</title><use href="#icon-play"></use></svg></button>
            <button name="stop" class="pulseOpacity" data-state="started" hidden type="button" data-style="subtle"><span class="sr-only" data-label>Stop</span><svg width=16 height=16><title>pause</title><use href="#icon-pause"></use></svg><pie-progress></pie-progress></pie-progress></button>
        </span>
</li>`;

class TaskList extends HTMLElement {
  #clients;
  #tasks;
  #allTasks;
  #tasksIndex = {};
  #settings;
  #currentTask;
  #newEntry;
  #durationTotal;
  #unsubscribe = {};
  constructor() {
    super();
    //implementation
    this.classList.add("stack");
    // TODO cleaner feature handling
    if (this.getAttribute("features")?.includes("add")) {
      this.appendChild(newtemplateItem(taskForm));
    }
    this.appendChild(newtemplateItem(template));
    this.elTotals = this.querySelector("[data-task-totals]");

    const that = this;
    this.dispatchEvent(
      new ContextRequestEvent(
        "state",
        (state, unsubscribe) => {
          this.#tasks = state.tasks;
          this.#settings = state.settings;
          this.#clients = state.clients;
          this.#currentTask = state.currentTask;
          this.#newEntry = state.newEntry;
          this.#durationTotal = state.durationTotal;
          this.#allTasks = state.allTasks;

          this.#unsubscribe.signals = effect(
            this.update.bind(this),
            this.#tasks,
            this.#settings,
            this.#clients,
            this.#currentTask,
            this.#newEntry,
            this.#durationTotal
          );

          this.#unsubscribe.tasksIndex = effect(
            this.indexTasks.bind(this),
            this.#tasks
          );

          this.#unsubscribe.datalist = effect(
            () => this.renderTaskDatalist(this.#allTasks?.value || []),
            this.#allTasks
          );

          this.#unsubscribe.state = unsubscribe;
        },
        true
      )
    );

    timeLoop(1000, () => {
      let newEntry = this.#newEntry?.value,
        currentTask = this.#currentTask?.value,
        settings = this.#settings?.value;
      if (!newEntry || !currentTask) return;
      const activeTaskEl = this.elTotals.querySelector(
        '[data-timing-state="start"]'
      );
      if (!activeTaskEl) return;
      const { focusInterval } = settings;
      const { start } = newEntry;
      const { total = 0 } = currentTask;
      const duration = calcDuration({ start, end: new Date() });
      if (focusInterval && focusInterval > 0 && duration > focusInterval) {
        // FIXME should use unique event
        playTripleBeep();
        const { exid } = activeTaskEl.closest("[data-exid]")?.dataset || {};
        Notification.requestPermission().then(function (permission) {
          if (permission === "granted") {
            // Permission was granted, create a 
            const task = that.getTaskById(exid);
            new Notification(`Time's up for task ${task?.description || exid} (${exid})`, {
              body: `You have been working on this task for more than ${formatDurationDecimal(
                focusInterval || 0
              )} hours.`, 
              icon: "favicon.ico",
            });
          } else {
            // Permission was denied or not granted
            console.log("Permission not granted");
          }
        });
        emitEvent(that, "stopTask", {
          exid,
        });
      }

      this.renderNewTaskDuration(activeTaskEl, {
        start,
        total,
        focusInterval,
      });
    });
    // FIXME add form should be a separate web component
    if (this.getAttribute("features")?.includes("add")) {
      this.newTaskForm = this.querySelector("[data-new-task]");
      const primaryInput = this.newTaskForm.querySelector('input[name="taskRaw"]');
      const inputGroup = primaryInput.closest('.input-group');

      // Spawn a new input row below the given reference input
      const spawnRow = (afterInput, value = '') => {
        // Wrap inputs in container if not already wrapped
        let container = inputGroup.querySelector('.batch-input-container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'batch-input-container';
          primaryInput.replaceWith(container);
          container.append(primaryInput);
        }
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.name = 'taskRawExtra';
        newInput.value = value;
        newInput.setAttribute('list', 'prev-tasks');
        // Remove row when emptied
        newInput.addEventListener('input', () => {
          if (!newInput.value && container.children.length > 1) {
            newInput.remove();
            // Unwrap container if only primary input remains
            if (container.children.length === 1) {
              container.replaceWith(primaryInput);
            }
          }
        });
        // Insert after the reference input
        afterInput.after(newInput);
        return newInput;
      };

      // Handle multi-line paste
      primaryInput.addEventListener('paste', (ev) => {
        const text = ev.clipboardData?.getData('text') || '';
        if (!text.includes('\n')) return;
        ev.preventDefault();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return;
        primaryInput.value = lines[0];
        let lastInput = primaryInput;
        for (let i = 1; i < lines.length; i++) {
          lastInput = spawnRow(lastInput, lines[i]);
        }
      });

      // Handle Ctrl+Enter to spawn new row
      primaryInput.addEventListener('keydown', (ev) => {
        if (ev.ctrlKey && ev.key === 'Enter') {
          ev.preventDefault();
          const newInput = spawnRow(primaryInput);
          newInput.focus();
        }
      });

      // Also allow Ctrl+Enter on extra rows
      inputGroup.addEventListener('keydown', (ev) => {
        if (ev.ctrlKey && ev.key === 'Enter' && ev.target.name === 'taskRawExtra') {
          ev.preventDefault();
          const newInput = spawnRow(ev.target);
          newInput.focus();
        }
      });

      this.newTaskForm.addEventListener("submit", function addTask(ev) {
        ev.preventDefault();
        const elExid = ev.target.elements.exid;
        const elClient = ev.target.elements.client;
        const container = inputGroup.querySelector('.batch-input-container');
        const extraInputs = container
          ? Array.from(container.querySelectorAll('input[name="taskRawExtra"]'))
          : [];

        if (extraInputs.length > 0) {
          // Batch mode: collect all input values
          const allInputs = [primaryInput, ...extraInputs];
          const tasks = allInputs
            .map(input => input.value.trim())
            .filter(Boolean)
            .map(raw => ({ raw }));
          if (tasks.length) {
            emitEvent(that, "addTasks", { tasks });
          }
          // Remove extra inputs and unwrap container
          for (const input of extraInputs) input.remove();
          if (container) container.replaceWith(primaryInput);
          primaryInput.value = "";
        } else {
          // Single task mode (preserves manual exid/client)
          emitEvent(that, "addTask", {
            raw: primaryInput.value,
            exid: elExid.value,
            client: elClient.value,
          });
          primaryInput.value = "";
        }
        elExid.value = "";
        elClient.value = "";

        // Close the details element
        const detailsElement = ev.target.querySelector('details');
        if (detailsElement) {
          detailsElement.open = false;
        }
      });
    }
    this.addEventListener("change", function toggleTaskComplete(ev) {
      switch (ev.target.name) {
        case "complete":
          emitEvent(that, "taskComplete", {
            exid: ev.target.closest("li").querySelector("[data-task]")
              .innerText,
            complete: ev.target.checked,
          });
          break;
      }
    });

    this.addEventListener("click", function handleArchiveAction(ev) {
      if (ev.target.closest("button") && ev.target.closest("[data-exid]")) {
        const btn = ev.target.closest("button");
        emitEvent(that, btn.name + "Task", {
          exid: btn.closest("[data-exid]").dataset.exid,
        });
        return false;
      }
    });
  }

  diconnectedCallback() {
    this.#unsubscribe.signals();
    this.#unsubscribe.state();
    this.#unsubscribe.tasksIndex();
  }

  update() {
    console.log("TaskList update called with tasks:", this.#tasks?.value);
    this.renderTasks({
      settings: this.#settings.value,
      tasks: this.#tasks.value,
      durationTotal: this.#durationTotal.value,
    });

    this.renderPrevClientDatalist(
      this.querySelector("#prev-clients"),
      this.#clients?.value || []
    );
  }

  getTaskById(exid) {
    return this.#tasksIndex[exid] || null;
  }

  indexTasks() {
    this.#tasksIndex = {};
    for (const task of this.#tasks.value) {
      this.#tasksIndex[task.exid] = task;
    }
    console.log("Indexed tasks", this.#tasksIndex);
  }

  renderTasks({ tasks = [], settings = {}, durationTotal = 0 }) {
    const elTotals = this.elTotals;
    
    console.log("Original tasks:", tasks);
    
    // Log tasks without exid for debugging
    if (tasks && tasks.length) {
      const tasksWithoutExid = tasks.filter(x => !x.exid);
      if (tasksWithoutExid.length) {
        console.warn("Tasks without exid:", tasksWithoutExid);
      }
    }

    let toRender = tasks.filter((x) => x && x.exid);
    console.log("Tasks after exid filter:", toRender);

    toRender = toRender.sort(sortByMostRecentEntry);

    if (!toRender.length || elTotals.childNodes.length > toRender.length) {
      for (const x of [...elTotals.childNodes]) {
        x.remove();
      }
    }

    for (let task of toRender) {
      let item = elTotals.querySelector(`[data-exid="${task.exid}"]`);

      if (!item) {
        item = newtemplateItem(taskRow);
      }
      elTotals.append(item);
      this.renderTask(item, task);
    }
    const el = this;
    // TODO: convert to component
    const elDurationTotal = el.querySelector("[data-duration-total]");
    elDurationTotal.setAttribute("hours", durationTotal);
    el.querySelector('[name="durationNetIncome"]').value = formatPrice(
      getNetIncome(durationTotal || 0, settings.rate || 0, settings.tax || 0)
    );
  }

  renderTask(
    item,
    {
      exid,
      client = "",
      timingState = "stop",
      description = "",
      total = 0,
      complete = false,
    }
  ) {
    item.dataset.exid = exid;
    item.querySelector("task-status").checked = complete;
    item.querySelector("[data-task]").innerText = exid;
    item.querySelector("[data-client]").innerText = client;
    const elDesc = item.querySelector("[data-description]");
    elDesc.innerText = description;
    elDesc.hidden = description.length == 0;
    const hasActions = this.getAttribute("features")?.includes("actions");
    item.querySelector("[data-actions]").hidden = !hasActions;
    item.dataset.state = "start" == timingState ? "active" : "inactive";
    const elTotal = item.querySelector("[data-task-total]");
    elTotal.setAttribute("hours", total);
    if (hasActions) {
      item.dataset.timingState = timingState;

      elTotal.classList.toggle("pulseOpacity", "start" == timingState);
      item.querySelector('[name="start"]').hidden = "start" == timingState;
      item.querySelector('[name="stop"]').hidden = "stop" == timingState;
    }
  }

  // FIXME could be split out a little better
  renderNewTaskDuration(el, { start, total, focusInterval } = {}) {
    const duration = calcDuration({ start, end: new Date() }, "milliseconds");

    el.dataset.state = start ? "active" : "inactive";
    const pieProgress = el.querySelector("pie-progress");
    pieProgress.setAttribute(
      "percent",
      duration / formatDurationDecimal(focusInterval)
    );
    const elDuration = el.querySelector("[data-task-total]");
    elDuration.setAttribute("duration", hoursToMilliseconds(total) + duration);
    elDuration.dataset.state = start ? "started" : "stopped";
  }

  renderTaskDatalist(tasks) {
    const datalist = this.querySelector("#prev-tasks");
    if (!datalist) return;
    const $frag = document.createDocumentFragment();
    for (const task of tasks) {
      const opt = document.createElement("OPTION");
      const parts = [];
      if (task.exid) parts.push(`#${task.exid}`);
      if (task.description) parts.push(task.description);
      if (task.project) parts.push(`+${task.project}`);
      if (task.client) parts.push(`client:${task.client}`);
      opt.value = parts.join(' ');
      $frag.append(opt);
    }
    datalist.innerHTML = "";
    datalist.append($frag);
  }

  renderPrevClientDatalist($prevClients, clients) {
    if (!$prevClients) return;
    const $frag = document.createDocumentFragment();
    for (const client of clients) {
      const opt = document.createElement("OPTION");
      opt.value = client.name;
      opt.innerText = client.name;
      $frag.append(opt);
    }
    $prevClients.innerHTML = "";
    $prevClients.append($frag);
  }
}

window.customElements.define("task-list", TaskList);
