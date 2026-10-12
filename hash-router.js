// Route depth: "#tasks" = 0, "#task/X" = 1. Moving deeper slides forward, shallower slides back.
const routeDepth = (hash) => hash.replace('#', '').split('/').filter(Boolean).length - 1;

const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

class HashRouter extends HTMLElement {
    #depth = 0;

    constructor() {
        super();
        window.addEventListener("hashchange", () => this.navigate(window.location.hash))
    }

    connectedCallback() {
        setTimeout(() => {
            this.#depth = Math.max(routeDepth(window.location.hash), 0);
            this.showPage(this.pageFor(window.location.hash));
        }, 0);
    }

    // Sub-routes like #task/<exid> resolve to the section with id "task"
    pageFor(hash) {
        const id = hash.replace('#', '').split('/')[0] || this.getAttribute('default');
        const byId = (pageId) => [...this.children].find(child => child.id === pageId);
        return byId(id) || byId(this.getAttribute('default'));
    }

    // Slide between drill-down levels; same-level navigation (tabs) swaps instantly
    navigate(hash) {
        const page = this.pageFor(hash);
        const depth = Math.max(routeDepth(hash), 0);
        const direction = depth > this.#depth ? 'forward' : depth < this.#depth ? 'back' : '';
        this.#depth = depth;
        if (!direction || !page || prefersReducedMotion()) return this.showPage(page);

        // View transition pseudo-elements hang off <html>, so direction is set there
        const root = document.documentElement;
        root.dataset.pageTransition = direction;
        const done = () => delete root.dataset.pageTransition;

        if (document.startViewTransition) {
            document.startViewTransition(() => this.showPage(page)).finished.finally(done);
        } else {
            // Fallback: only the incoming page animates (CSS keyframes)
            this.showPage(page);
            page.addEventListener('animationend', done, { once: true });
            setTimeout(done, 500);
        }
    }

    showPage(page) {
        if (!page) return;
        for(let child of this.children){
            child.hidden = true;
        }
        page.hidden = false;
    }

}

window.customElements.define('hash-router', HashRouter);
