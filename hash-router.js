class HashRouter extends HTMLElement {
    constructor() {
        super();
        window.addEventListener("hashchange", () => this.showPage(this.pageFor(window.location.hash)))
    }

    connectedCallback() {
        setTimeout(() => {
            this.showPage(this.pageFor(window.location.hash));
        }, 0);
    }

    // Sub-routes like #task/<exid> resolve to the section with id "task"
    pageFor(hash) {
        const id = hash.replace('#', '').split('/')[0] || this.getAttribute('default');
        return this.querySelector(`:scope > #${CSS.escape(id)}`)
            || this.querySelector(`:scope > #${CSS.escape(this.getAttribute('default'))}`);
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