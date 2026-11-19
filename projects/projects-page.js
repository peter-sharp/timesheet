// Projects timeline: top-level projects grouped by due month, 3 months either side of now.
// Older/further-future months are paged a window at a time via the projectsOffset signal.
import { ContextRequestEvent } from '../utils/Context.js';
import { effect } from '../utils/Signal.js';
import emitEvent from '../utils/emitEvent.js';
import round1dp from '../utils/round1dp.js';
import { groupProjectsByMonth, projectOptions } from '../utils/projects.js';

const ROUTE = '#projects';

const template = document.createElement('template');
template.innerHTML = /*html*/`
<div class="stack projects">
    <details class="projects__new">
        <summary class="h5">New project</summary>
        <form class="stack" data-new-project>
            <div class="row">
                <div class="input-group">
                    <label for="newProjectName">Name</label>
                    <input id="newProjectName" name="name" type="text" required autocomplete="off">
                </div>
                <div class="input-group">
                    <label for="newProjectDue">Due</label>
                    <input id="newProjectDue" name="due" type="date">
                </div>
            </div>
            <div class="input-group">
                <label for="newProjectParent">Parent project</label>
                <input id="newProjectParent" name="parent" type="text" list="newProjectParents" autocomplete="off">
                <datalist id="newProjectParents"></datalist>
            </div>
            <div class="row">
                <div class="input-group">
                    <label for="newProjectDescription">Description <small>(creates a project task)</small></label>
                    <input id="newProjectDescription" name="description" type="text" autocomplete="off">
                </div>
                <div class="input-group">
                    <label for="newProjectEstimate">Estimate</label>
                    <input id="newProjectEstimate" name="estimate" type="text" placeholder="e.g. 2h" autocomplete="off">
                </div>
            </div>
            <button type="submit">Add project</button>
        </form>
    </details>
    <button type="button" data-action="later" hidden>Later</button>
    <details class="projects__undated" data-undated hidden>
        <summary class="h5">No due date (<span data-count></span>)</summary>
        <ol class="unstyled-list stack projects__list"></ol>
    </details>
    <div class="stack projects__timeline" data-months></div>
    <p class="projects__empty" data-empty hidden>No projects in this period. Add one above or tag tasks with <code>+project</code>.</p>
    <button type="button" data-action="earlier" hidden>Earlier</button>
</div>`;

const el = (tag, { dataset = {}, ...props } = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    Object.assign(node.dataset, dataset);
    node.append(...children.filter(c => c !== null && c !== undefined));
    return node;
};

export const formatDue = (due) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(due || '');
    return match
        ? new Date(+match[1], +match[2] - 1, +match[3]).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
};

export const projectHref = (tag) => `#project/${encodeURIComponent(tag)}`;

// Drill-down chevron, same markup as the task list's details link
export function detailsLink(href, label) {
    const link = el('a', { href, className: 'task-item__details-link' }, el('span', { className: 'sr-only', textContent: label }));
    link.dataset.style = 'subtle';
    link.insertAdjacentHTML('beforeend', '<svg width=16 height=16><title>view details</title><use href="#icon-chevron-right"></use></svg>');
    return link;
}

// Shared card: name, due date, drill-down, progress and time vs estimate
export function projectCard(project) {
    const pct = Math.round(project.progress * 100);
    const card = el('article', { className: 'project-card stack' },
        el('header', { className: 'project-card__header' },
            el('h4', { className: 'h5 margin-0', textContent: project.name }),
            project.due ? el('time', { dateTime: project.due, textContent: formatDue(project.due) }) : null,
            detailsLink(projectHref(project.tag), `View ${project.name}`)
        ),
        el('progress', { max: 100, value: pct, textContent: `${pct}%` }),
        el('p', { className: 'project-card__meta margin-0' },
            el('span', { dataset: { progress: '' }, textContent: `${project.done}/${project.count} done` }),
            ' · ',
            el('span', { dataset: { time: '' }, textContent: `${round1dp(project.hours)}h / ${round1dp(project.estimate)}h` })
        )
    );
    if (project.children.length) {
        card.append(el('ul', { className: 'unstyled-list project-card__children' },
            ...project.children.map(child => el('li', {},
                el('span', { textContent: `${child.name} ${child.done}/${child.count}` }),
                detailsLink(projectHref(child.tag), `View ${child.name}`)
            ))
        ));
    }
    return card;
}

const listItems = (projects) => projects.map(project => el('li', {}, projectCard(project)));

customElements.define('projects-page', class extends HTMLElement {
    #projects;
    #offset;
    #tasks;
    #unsubscribeSignals;
    #unsubscribeState;

    connectedCallback() {
        if (!this.firstElementChild) this.append(template.content.cloneNode(true));

        this.dispatchEvent(new ContextRequestEvent('state', (state, unsubscribe) => {
            this.#projects = state.projects;
            this.#offset = state.projectsOffset;
            this.#tasks = state.allTasksWithDeleted;
            this.#unsubscribeState = unsubscribe;
            this.#unsubscribeSignals?.();
            this.#unsubscribeSignals = effect(() => this.#render(), ...[this.#projects, this.#offset, this.#tasks].filter(Boolean));
        }, true));

        this.querySelector('[data-new-project]').addEventListener('submit', (ev) => {
            ev.preventDefault();
            const form = ev.target;
            emitEvent(this, 'addProject', Object.fromEntries(
                ['name', 'due', 'parent', 'description', 'estimate'].map(name => [name, form.elements[name].value])
            ));
            form.reset();
        });
        this.querySelector('[data-action="earlier"]').addEventListener('click', () => this.#load((this.#offset?.value ?? 0) - 1));
        this.querySelector('[data-action="later"]').addEventListener('click', () => this.#load((this.#offset?.value ?? 0) + 1));

        this._onHashChange = () => {
            if (window.location.hash === ROUTE) this.#load();
        };
        window.addEventListener('hashchange', this._onHashChange);
        if (window.location.hash === ROUTE) this.#load();
    }

    disconnectedCallback() {
        this.#unsubscribeSignals?.();
        this.#unsubscribeState?.();
        window.removeEventListener('hashchange', this._onHashChange);
    }

    #load(offset = this.#offset?.value ?? 0) {
        emitEvent(this, 'loadProjects', { offset });
    }

    #render() {
        const offset = this.#offset?.value ?? 0;
        const { undated, months, hasEarlier, hasLater } = groupProjectsByMonth(this.#projects?.value || [], { offset });

        this.querySelector('[data-new-project] datalist').replaceChildren(...projectOptions(this.#projects?.value, (this.#tasks?.value || []).filter(t => !t.deleted))
            .map(value => el('option', { value })));

        const undatedSection = this.querySelector('[data-undated]');
        undatedSection.hidden = !undated.length;
        undatedSection.querySelector('[data-count]').textContent = undated.length;
        undatedSection.querySelector('ol').replaceChildren(...listItems(undated));

        // Newest at top: mobile users scroll down into the past
        this.querySelector('[data-months]').replaceChildren(...[...months].reverse().map(month =>
            el('section', { className: 'stack projects__month', dataset: { month: month.key } },
                el('h3', { className: 'h5', textContent: month.label }),
                el('ol', { className: 'unstyled-list stack projects__list' }, ...listItems([...month.projects].reverse()))
            )
        ));

        this.querySelector('[data-empty]').hidden = !!(undated.length || months.length);
        this.querySelector('[data-action="later"]').hidden = !hasLater;
        this.querySelector('[data-action="earlier"]').hidden = !hasEarlier;
    }
});
