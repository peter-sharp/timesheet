class HashRouter extends HTMLElement {
    constructor() {
        super();
        //implementation
        window.addEventListener("hashchange", () => this.showPage(this.querySelector(":target")))
    }

    connectedCallback() {
        setTimeout(() => {
            const initial = window.location.hash.replace('#', '') || this.getAttribute('default');
            this.showPage(this.querySelector(`#${initial}`));
        }, 0);
    }

    showPage(page) {
        for(let child of this.children){
            child.hidden = true;
        }
        page.hidden = false;
    }

}

window.customElements.define('hash-router', HashRouter);