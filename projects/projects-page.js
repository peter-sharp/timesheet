// Projects timeline: top-level projects grouped by due month, 3 months either side of now.
// Older/further-future months are paged a window at a time via the projectsOffset signal.
import { ContextRequestEvent } from '../utils/Context.js';
import { effect } from '../utils/Signal.js';
import emitEvent from '../utils/emitEvent.js';
import round1dp from '../utils/round1dp.js';
import { groupProjectsByMonth } from '../utils/projects.js';

const ROUTE = '#projects';

const template = document.createElement('template');
template.innerHTML = /*html*/`
<div class="stack projects">
    <button type="button" data-action="later" hidden>Later</button>
    <section class="stack" data-undated hidden>
        <h3 class="h5">No due date</h3>
        <ol class="unstyled-list stack projects__list"></ol>
    </section>
    <div class="stack" data-months></div>
    <p class="projects__empty" data-empty hidden>No projects in this period. Tag tasks with <code>+project</code> to see them here.</p>
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

// Shared card: name link, due date, progress and time vs estimate
export function projectCard(project) {
    const pct = Math.round(project.progress * 100);
    const card = el('article', { className: 'project-card stack' },
        el('header', { className: 'project-card__header' },
            el('h4', { className: 'h5 margin-0' }, el('a', { href: projectHref(project.tag), textContent: project.name })),
            project.due ? el('time', { dateTime: project.due, textContent: formatDue(project.due) }) : null
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
                el('a', { href: projectHref(child.tag), textContent: child.name }),
                ` ${child.done}/${child.count}`
            ))
        ));
    }
    return card;
}

const listItems = (projects) => projects.map(project => el('li', {}, projectCard(project)));

customElements.define('projects-page', class extends HTMLElement {
    #projects;
    #offset;
    #unsubscribeSignals;
    #unsubscribeState;

    connectedCallback() {
        if (!this.firstElementChild) this.append(template.content.cloneNode(true));

        this.dispatchEvent(new ContextRequestEvent('state', (state, unsubscribe) => {
            this.#projects = state.projects;
            this.#offset = state.projectsOffset;
            this.#unsubscribeState = unsubscribe;
            this.#unsubscribeSignals?.();
            this.#unsubscribeSignals = effect(() => this.#render(), this.#projects, this.#offset);
        }, true));

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

        const undatedSection = this.querySelector('[data-undated]');
        undatedSection.hidden = !undated.length;
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
