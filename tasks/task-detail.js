import { ContextRequestEvent } from "../utils/Context.js";
import { effect } from "../utils/Signal.js";
import emitEvent from "../utils/emitEvent.js";
import newtemplateItem from "../utils/newTemplateItem.js";

// Drill-down screen for editing a task's properties. Routed via #task/<exid>
const ROUTE = "#task/";

const template = document.createElement("template");
template.innerHTML = /*html*/ `
<div class="stack">
    <a href="#tasks" class="task-detail__back">&#x2039; Back to tasks</a>
    <p data-not-found hidden>Task not found.</p>
    <form class="stack task-detail__form" hidden>
        <p class="opacity50 margin-0">#<span data-exid></span></p>
        <div class="input-group">
            <label for="taskDetailDescription">Description</label>
            <input id="taskDetailDescription" type="text" name="description" autocomplete="off">
        </div>
        <div class="row">
            <div class="input-group">
                <label for="taskDetailProject">Project</label>
                <input id="taskDetailProject" type="text" name="project">
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
                <input id="taskDetailEstimate" type="number" name="estimate" step="0.1" min="0" placeholder="0.8">
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

class TaskDetail extends HTMLElement {
  #tasks;
  #unsubscribe = {};
  #form;
  #renderedExid = null;

  // Built on first connect, since document.createElement forbids children in the constructor
  #build() {
    this.appendChild(newtemplateItem(template));
    this.#form = this.querySelector("form");
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
  }

  #handleHashChange = () => this.render(true);

  connectedCallback() {
    if (!this.#form) this.#build();
    window.addEventListener("hashchange", this.#handleHashChange);
    this.dispatchEvent(
      new ContextRequestEvent(
        "state",
        (state, unsubscribe) => {
          this.#tasks = state.tasks;
          this.#unsubscribe.state = unsubscribe;
          this.#unsubscribe.signals?.();
          this.#unsubscribe.signals = effect(() => this.render(false), this.#tasks);
        },
        true
      )
    );
    this.render(true);
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.#handleHashChange);
    this.#unsubscribe.signals?.();
    this.#unsubscribe.state?.();
  }

  // Populate the form on navigation; on signal updates only refill if a different
  // task is shown, so in-progress edits aren't clobbered
  render(navigated) {
    const exid = exidFromHash(window.location.hash);
    if (!exid) return;
    const task = (this.#tasks?.value || []).find((t) => t.exid === exid);
    this.#form.hidden = !task;
    this.querySelector("[data-not-found]").hidden = !!task;
    if (!task) {
      this.#renderedExid = null;
      return;
    }
    if (!navigated && this.#renderedExid === exid) return;
    this.#renderedExid = exid;
    this.querySelector("[data-exid]").textContent = exid;
    for (const name of FIELDS) {
      this.#form.elements[name].value = task[name] || "";
    }
  }
}

window.customElements.define("task-detail", TaskDetail);
