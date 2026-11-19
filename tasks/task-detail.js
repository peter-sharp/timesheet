import { ContextRequestEvent } from "../utils/Context.js";
import { effect } from "../utils/Signal.js";
import emitEvent from "../utils/emitEvent.js";
import newtemplateItem from "../utils/newTemplateItem.js";
import timeLoop from "../utils/timeLoop.js";
import calcDuration from "../utils/calcDuration.js";
import { taskEstimate } from "../utils/estimate.js";
import { projectOptions } from "../utils/projects.js";

// Drill-down screen for editing a task's properties. Routed via #task/<exid>
const ROUTE = "#task/";

const template = document.createElement("template");
template.innerHTML = /*html*/ `
<div class="stack">
    <a href="#tasks" class="task-detail__back">&#x2039; Back to tasks</a>
    <p data-not-found hidden>Task not found.</p>
    <form class="stack task-detail__form" hidden>
        <div class="row task-detail__header">
            <p class="opacity50 margin-0">#<span data-exid></span></p>
            <button name="start" type="button" data-style="subtle"><span class="sr-only">Start</span><svg width=16 height=16><title>play</title><use href="#icon-play"></use></svg></button>
            <button name="stop" class="pulseOpacity" type="button" data-style="subtle" hidden><span class="sr-only">Stop</span><svg width=16 height=16><title>pause</title><use href="#icon-pause"></use></svg></button>
        </div>
        <div class="input-group">
            <label for="taskDetailDescription">Description</label>
            <input id="taskDetailDescription" type="text" name="description" autocomplete="off">
        </div>
        <div class="row">
            <div class="input-group">
                <label for="taskDetailProject">Project</label>
                <input id="taskDetailProject" type="text" name="project" list="taskDetailProjects" autocomplete="off">
                <datalist id="taskDetailProjects"></datalist>
            </div>
            <div class="input-group">
                <label for="taskDetailContext">Context</label>
                <input id="taskDetailContext" type="text" name="context">
            </div>
        </div>
        <div class="row">
            <div class="input-group">
                <label for="taskDetailClient">Client</label>
                <input id="taskDetailClient" type="text" name="client">
            </div>
            <div class="input-group">
                <label for="taskDetailPriority">Priority</label>
                <input id="taskDetailPriority" type="text" name="priority" maxlength="1" pattern="[A-Za-z]" size="2">
            </div>
        </div>
        <div class="row">
            <div class="input-group">
                <label for="taskDetailDue">Due</label>
                <input id="taskDetailDue" type="text" name="due" placeholder="YYYY-MM-DD">
            </div>
            <div class="input-group">
                <label for="taskDetailEstimate">Estimate (h)</label>
                <div class="row">
                    <input id="taskDetailEstimate" type="number" name="estimate" step="0.1" min="0" placeholder="0.8" aria-describedby="taskDetailEstimateTaken">
                    <output id="taskDetailEstimateTaken" name="estimateTaken" class="task-detail__estimate-taken" for="taskDetailEstimate"></output>
                </div>
            </div>
        </div>
        <div class="row">
            <button type="submit">Save</button>
            <a href="#tasks">Cancel</a>
        </div>
    </form>
</div>`;

const FIELDS = ["description", "project", "context", "client", "priority", "due", "estimate"];

const exidFromHash = (hash) =>
  hash.startsWith(ROUTE) ? decodeURIComponent(hash.slice(ROUTE.length)) : "";

// All-time hours (previous days + today + running entry) as a whole % of the estimate
export const percentOfEstimate = (hours, estimate) =>
  Math.round((hours / taskEstimate({ estimate })) * 100);

class TaskDetail extends HTMLElement {
  #tasks;
  #newEntry;
  #taskPastTotals;
  #projects;
  #allTasks;
  #projectList;
  #unsubscribe = {};
  #form;
  #loop;
  #renderedExid = null;

  // Built on first connect, since document.createElement forbids children in the constructor
  #build() {
    this.appendChild(newtemplateItem(template));
    this.#form = this.querySelector("form");
    this.#projectList = this.#form.querySelector("datalist");
    this.#form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const exid = exidFromHash(window.location.hash);
      if (!exid) return;
      const changes = Object.fromEntries(
        FIELDS.map((name) => [name, this.#form.elements[name].value.trim()])
      );
      emitEvent(this, "updateTask", { exid, ...changes });
      window.location.hash = "#tasks";
    });
    this.#form.addEventListener("click", (ev) => {
      const btn = ev.target.closest('button[name="start"], button[name="stop"]');
      const exid = exidFromHash(window.location.hash);
      if (btn && exid) emitEvent(this, btn.name + "Task", { exid });
    });
    this.#form.elements.estimate.addEventListener("input", () => this.renderTiming());
  }

  #handleHashChange = () => {
    if (exidFromHash(window.location.hash)) emitEvent(this, "loadProjects");
    this.render(true);
  };

  connectedCallback() {
    if (!this.#form) this.#build();
    window.addEventListener("hashchange", this.#handleHashChange);
    this.dispatchEvent(
      new ContextRequestEvent(
        "state",
        (state, unsubscribe) => {
          this.#tasks = state.tasks;
          this.#newEntry = state.newEntry;
          this.#taskPastTotals = state.taskPastTotals;
          this.#projects = state.projects;
          this.#allTasks = state.allTasksWithDeleted;
          this.#unsubscribe.state = unsubscribe;
          this.#unsubscribe.signals?.();
          this.#unsubscribe.signals = effect(
            () => this.render(false),
            ...[this.#tasks, this.#newEntry, this.#taskPastTotals].filter(Boolean)
          );
          this.#unsubscribe.projects?.();
          this.#unsubscribe.projects = effect(
            () => this.renderProjectOptions(),
            ...[this.#projects, this.#allTasks, this.#tasks].filter(Boolean)
          );
        },
        true
      )
    );
    if (exidFromHash(window.location.hash)) emitEvent(this, "loadProjects");
    this.render(true);
    // Keep the % taken live while this task is being timed
    this.#loop = timeLoop(1000, () => {
      if (this.#newEntry?.value?.start) this.renderTiming();
    });
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.#handleHashChange);
    if (this.#loop) clearTimeout(this.#loop.timeout);
    this.#unsubscribe.signals?.();
    this.#unsubscribe.projects?.();
    this.#unsubscribe.state?.();
  }

  // Project suggestions: known projects, then other task exids (excluding this task)
  renderProjectOptions() {
    const exid = exidFromHash(window.location.hash);
    const tasks = [...(this.#tasks?.value || []), ...(this.#allTasks?.value || [])]
      .filter((t) => !t.deleted && String(t.exid) !== exid);
    this.#projectList?.replaceChildren(
      ...projectOptions(this.#projects?.value, tasks)
        .filter((value) => value !== exid)
        .map((value) => Object.assign(document.createElement("option"), { value }))
    );
  }

  // Populate the form on navigation; on signal updates only refill if a different
  // task is shown, so in-progress edits aren't clobbered
  #currentTask() {
    const exid = exidFromHash(window.location.hash);
    return exid ? (this.#tasks?.value || []).find((t) => t.exid === exid) : undefined;
  }

  render(navigated) {
    const exid = exidFromHash(window.location.hash);
    if (!exid) return;
    const task = this.#currentTask();
    this.#form.hidden = !task;
    this.querySelector("[data-not-found]").hidden = !!task;
    if (!task) {
      this.#renderedExid = null;
      return;
    }
    this.renderTiming();
    if (!navigated && this.#renderedExid === exid) return;
    this.#renderedExid = exid;
    this.querySelector("[data-exid]").textContent = exid;
    for (const name of FIELDS) {
      this.#form.elements[name].value = task[name] || "";
    }
    this.renderTiming();
  }

  // Play/pause toggle and % of estimate taken (uses the estimate as currently typed)
  renderTiming() {
    const task = this.#currentTask();
    if (!task) return;
    const newEntry = this.#newEntry?.value || {};
    const timing = newEntry.task === task.exid && !!newEntry.start;
    this.#form.querySelector('[name="start"]').hidden = timing;
    this.#form.querySelector('[name="stop"]').hidden = !timing;

    const pastHours = this.#taskPastTotals?.value?.[task.exid] || 0;
    const runningHours = timing ? calcDuration({ start: new Date(newEntry.start), end: new Date() }) : 0;
    const percent = percentOfEstimate(pastHours + (task.total || 0) + runningHours, this.#form.elements.estimate.value);
    const output = this.#form.elements.estimateTaken;
    output.value = `${percent}% taken`;
    output.toggleAttribute("data-over", percent > 100);
  }
}

window.customElements.define("task-detail", TaskDetail);
