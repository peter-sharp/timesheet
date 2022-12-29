/**
 * Creates model with given functions and state
 * @param fns reducers to update business logic
 * @param initialState initial state of model
 **/
function Model(fns, initialState) {
    let state = { ...initialState };
    function emit(ev) {
        state = fns.reduce((s, fn) => fn(s, ev), state)
        listeners.forEach(fn => fn({ ...state }));
    }

    const listeners = [];
    function listen(fn) {
        listeners.push(fn);
    }
    return {
        emit,
        listen
    }
}

function Store(key, hydrateFn, dehydrateFn, initialState) {
    async function read() {
        let data = {};
        try {
            data = JSON.parse(localStorage.getItem(key)) || {};
        } catch (e) {
            console.error(e);
            data.errors = [e];
        }
        return hydrateFn({...initialState, ...data});
    }
    async function write(data) {
        localStorage.setItem(key, JSON.stringify(dehydrateFn(data)));
    }
    return {
        read,
        write
    }
}
