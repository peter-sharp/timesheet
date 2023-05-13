class HashRouter extends HTMLElement {
    constructor() {
        super();
        //implementation
        window.addEventListener("hashchange", () => this.showPage(this.querySelector(":target")))
    }

    connectedCallback() {
        setTimeout(() => {
            this.showPage(this.querySelector(`#${this.getAttribute('default')}`))
        }, 0);
    }

    showPage(page) {
        for( let child of this.children){
            child.hidden = true;
        }
        page.hidden = false;
    }

}

window.customElements.define('hash-router', HashRouter);