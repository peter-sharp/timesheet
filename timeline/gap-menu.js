import emitEvent from "../utils/emitEvent.js";
import format24hour from "../utils/format24Hour.js";
import { formatShortDuration } from "../utils/dayRibbon.js";

const template = document.createElement('template');
template.innerHTML = /*html*/`
<div class="gap-menu" hidden role="menu" aria-label="Fill gap">
    <p class="gap-menu__header" data-header></p>
    <input class="gap-menu__filter" type="search" placeholder="Filter tasks" aria-label="Filter tasks" data-filter>
    <div class="gap-menu__options" data-options></div>
    <p class="gap-menu__empty" data-empty hidden>No matching tasks</p>
</div>`;

const VISIBLE_LIMIT = 12;

/**
 * Popup list of tasks used to fill an unaccounted stretch of the day.
 * Light DOM so the `updateState` event emitted on choice still bubbles to <app-context>.
 */
class GapMenu extends HTMLElement {

    #tasks = [];
    #gap = null;
    #onOutsideClick;
    #onKeydown;

    connectedCallback() {
        this.init();
    }

    /** Builds the popup. Deferred out of the constructor: a custom element may not add children there. */
    init() {
        if (this.menu) return;
        this.append(template.content.cloneNode(true));
        this.menu = this.querySelector('.gap-menu');
        this.header = this.querySelector('[data-header]');
        this.filter = this.querySelector('[data-filter]');
        this.options = this.querySelector('[data-options]');
        this.empty = this.querySelector('[data-empty]');

        this.filter.addEventListener('input', () => this.renderOptions(this.filter.value));

        this.options.addEventListener('click', (ev) => {
            const option = ev.target.closest('[data-exid]');
            if (!option) return;
            ev.stopPropagation();
            const { start, end } = this.#gap || {};
            this.close();
            if (!start || !end) return;
            emitEvent(this, 'fillGap', { task: option.dataset.exid, start, end });
        });

        this.#onOutsideClick = (ev) => {
            if (!this.contains(ev.target)) this.close();
        };
        this.#onKeydown = (ev) => {
            if (ev.key === 'Escape') {
                this.close();
                this.#gap?.anchor?.focus?.();
            }
        };
    }

    disconnectedCallback() {
        if (!this.#onOutsideClick) return;
        document.removeEventListener('click', this.#onOutsideClick);
        document.removeEventListener('keydown', this.#onKeydown);
    }

    /** @param {Array<{exid: string, description?: string, status?: string}>} tasks ordered: today's first, then recent */
    set tasks(tasks) {
        this.#tasks = Array.isArray(tasks) ? tasks : [];
    }

    get isOpen() {
        return !!this.menu && !this.menu.hidden;
    }

    /** @param {{start: Date, end: Date, anchor: HTMLElement}} gap */
    open({ start, end, anchor }) {
        this.init();
        this.#gap = { start, end, anchor };
        this.header.textContent = `${format24hour(start)}–${format24hour(end)} · ${formatShortDuration(end - start)}`;
        this.filter.value = '';
        this.renderOptions('');
        this.menu.hidden = false;
        this.position(anchor);
        // Attached late so the click that opened the menu doesn't immediately close it
        setTimeout(() => {
            document.addEventListener('click', this.#onOutsideClick);
            document.addEventListener('keydown', this.#onKeydown);
        }, 0);
        this.filter.focus({ preventScroll: true });
    }

    close() {
        if (!this.menu) return;
        this.menu.hidden = true;
        this.#gap = null;
        document.removeEventListener('click', this.#onOutsideClick);
        document.removeEventListener('keydown', this.#onKeydown);
    }

    /** Anchors the popup under the tapped gap, clamped to the viewport. */
    position(anchor) {
        if (!anchor?.getBoundingClientRect) return;
        const rect = anchor.getBoundingClientRect();
        const width = this.menu.offsetWidth || 220;
        const viewport = window.innerWidth || 360;
        const left = Math.max(8, Math.min(rect.left, viewport - width - 8));
        this.menu.style.setProperty('--gap-menu-left', `${left}px`);
        this.menu.style.setProperty('--gap-menu-top', `${rect.bottom + 4}px`);
    }

    renderOptions(query) {
        const needle = String(query || '').trim().toLowerCase();
        const matches = this.#tasks.filter((task) => !needle
            || `${task.exid} ${task.description || ''}`.toLowerCase().includes(needle));
        const shown = needle ? matches : matches.slice(0, VISIBLE_LIMIT);
        this.options.replaceChildren(...shown.map((task) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'gap-menu__option';
            option.setAttribute('role', 'menuitem');
            option.dataset.exid = task.exid;
            const exid = document.createElement('span');
            exid.className = 'gap-menu__exid';
            exid.textContent = task.exid;
            const desc = document.createElement('span');
            desc.className = 'gap-menu__desc';
            desc.textContent = task.description || '';
            option.append(exid, desc);
            return option;
        }));
        this.empty.hidden = shown.length > 0;
    }
}

customElements.define('gap-menu', GapMenu);
export default GapMenu;
