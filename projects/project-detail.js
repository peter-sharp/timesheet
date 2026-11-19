// Project drill-down (#project/<tag>): totals, dedicated task link, sub-projects and member tasks.
import { ContextRequestEvent } from '../utils/Context.js';
import { effect } from '../utils/Signal.js';
import emitEvent from '../utils/emitEvent.js';
import round1dp from '../utils/round1dp.js';
import { findProject } from '../utils/projects.js';
import { projectCard, formatDue } from './projects-page.js';

const ROUTE = '#project/';

const template = document.createElement('template');
template.innerHTML = /*html*/`
<div class="stack project-detail">
    <a href="#projects">&larr; Projects</a>
    <p data-missing hidden>Project not found.</p>
    <div class="stack" data-found hidden>
        <h3 class="h4 margin-0" data-name></h3>
        <dl class="stats-goals">
            <div><dt>Progress</dt><dd data-stat="progress"></dd></div>
            <div><dt>Due</dt><dd data-stat="due"></dd></div>
            <div><dt>Time spent</dt><dd data-stat="hours"></dd></div>
            <div><dt>Estimate</dt><dd data-stat="estimate"></dd></div>
        </dl>
        <p data-dedicated hidden><a>Edit project task</a></p>
        <section class="stack" data-children hidden>
            <h4 class="h5">Sub-projects</h4>
            <ol class="unstyled-list stack"></ol>
        </section>
        <section class="stack" data-tasks>
            <h4 class="h5">Tasks</h4>
            <ul class="unstyled-list stack project-detail__tasks"></ul>
        </section>
    </div>
</div>`;

const tagFromHash = (hash) => hash.startsWith(ROUTE) ? decodeURIComponent(hash.slice(ROUTE.length)) : '';
const isComplete = (task) => !!task.complete || task.status === 'complete';

customElements.define('project-detail', class extends HTMLElement {
    #projects;
    #tasks;
    #unsubscribeSignals;
    #unsubscribeState;

    connectedCallback() {
        if (!this.firstElementChild) this.append(template.content.cloneNode(true));

        this.dispatchEvent(new ContextRequestEvent('state', (state, unsubscribe) => {
            this.#projects = state.projects;
            this.#tasks = state.tasks;
            this.#unsubscribeState = unsubscribe;
            this.#unsubscribeSignals?.();
            this.#unsubscribeSignals = effect(() => this.#render(), this.#projects, this.#tasks);
        }, true));

        this._onHashChange = () => {
            if (tagFromHash(window.location.hash)) {
                this.#render();
                emitEvent(this, 'loadProjects');
            }
        };
        window.addEventListener('hashchange', this._onHashChange);
        this._onHashChange();
    }

    disconnectedCallback() {
        this.#unsubscribeSignals?.();
        this.#unsubscribeState?.();
        window.removeEventListener('hashchange', this._onHashChange);
    }

    #render() {
        const tag = tagFromHash(window.location.hash);
        if (!tag) return;
        const project = findProject(this.#projects?.value || [], tag);
        this.querySelector('[data-missing]').hidden = !!project;
        this.querySelector('[data-found]').hidden = !project;
        if (!project) return;

        this.querySelector('[data-name]').textContent = project.name;
        const stat = (name, text) => { this.querySelector(`[data-stat="${name}"]`).textContent = text; };
        stat('progress', `${project.done}/${project.count} done (${Math.round(project.progress * 100)}%)`);
        stat('due', formatDue(project.due) || 'None');
        stat('hours', `${round1dp(project.hours)}h`);
        stat('estimate', `${round1dp(project.estimate)}h`);

        // Task detail only edits tasks in today's list, so only link to those
        const editable = new Set((this.#tasks?.value || []).map(t => String(t.exid)));
        const taskHref = (task) => editable.has(String(task.exid)) ? `#task/${encodeURIComponent(task.exid)}` : '';

        const dedicated = this.querySelector('[data-dedicated]');
        dedicated.hidden = !(project.task && taskHref(project.task));
        if (!dedicated.hidden) dedicated.querySelector('a').href = taskHref(project.task);

        const children = this.querySelector('[data-children]');
        children.hidden = !project.children.length;
        children.querySelector('ol').replaceChildren(...project.children.map(child => {
            const li = document.createElement('li');
            li.append(projectCard(child));
            return li;
        }));

        this.querySelector('[data-tasks] ul').replaceChildren(...project.tasks.map(task => {
            const li = document.createElement('li');
            li.className = isComplete(task) ? 'project-detail__task--done' : '';
            const href = taskHref(task);
            li.append(Object.assign(document.createElement(href ? 'a' : 'span'), {
                ...(href ? { href } : {}),
                textContent: task.description || task.exid
            }));
            if (task.due) li.append(` due ${formatDue(task.due)}`);
            return li;
        }));
    }
});
