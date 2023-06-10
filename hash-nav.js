class HashNav extends HTMLElement {
    constructor() {
        super();
        window.addEventListener("hashchange", () => this.setActive(window.location.hash))
    }

    connectedCallback() {
        setTimeout(() => {
            const initial = window.location.hash || '#' + this.getAttribute('default');
            this.setActive(initial);
        }, 0);
    }

    setActive(page) {

        for(let child of this.querySelectorAll('a')){
            child.classList.remove('active');
        }
        const pageLink = this.querySelector(`a[href="${page}"]`)
        pageLink?.classList.add('active');
    }

}

window.customElements.define('hash-nav', HashNav);