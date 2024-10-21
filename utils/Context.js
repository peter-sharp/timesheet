//SEE https://plainvanillaweb.com/blog/articles/2024-10-07-needs-more-context/

export class ContextRequestEvent extends Event {
    constructor(context, callback, subscribe) {
        super('context-request', {
            bubbles: true,
            composed: true
        });
        this.context = context;
        this.callback = callback;
        this.subscribe = subscribe;
    }
}

export class ContextProvider extends EventTarget {
    #value;
    get value() { return this.#value }
    set value(value) {

        this.#value = value;
        this.dispatchEvent(new CustomEvent('change', { detail: this.#value }));
    }

    #context;
    get context() { return this.#context }
    
    constructor(target, context, initialValue = undefined) {
        super()
        this.#context = context;
        this.#value = initialValue;
        this.handle = this.handle.bind(this);
        if(target) this.attach(target);
    }

    attach(target) {
        target.addEventListener('context-request', this.handle);

    }

    detach(target) {
        target.removeEventListener('context-request', this.handle);
    }

    handle(event) {
        if (event.context === this.context) {
            if(event.subscribe) {
                const unsubscribe = () => this.removeEventListener('change', update);
                const update = () => event.callback(this.value, unsubscribe);
                this.addEventListener('change', update);
                update();
            } else {
                event.callback(this.value);
            }
            event.stopPropagation();
        }
    }
}