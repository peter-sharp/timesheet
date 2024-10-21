//SEE: https://plainvanillaweb.com/blog/articles/2024-08-30-poor-mans-signals/

export class Signal extends EventTarget {
    #value;
    get value() { return this.#value; }
    set value(value) {
        if (this.#value === value) return;
        this.#value = value;
        this.dispatchEvent(new CustomEvent('change', { detail: value }));
    }

    constructor(value) {
        super();
        this.#value = value;
    }

    effect(fn) {
        fn();
        this.addEventListener('change', fn);
        return () => this.removeEventListener('change', fn);
    }

    valueOf () { return this.#value; }
    toString () { return String(this.#value); }

}

export default function signal(_) {
    return new Signal(_);
}