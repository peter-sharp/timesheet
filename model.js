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

function Store(key, hydrateFn, initialState) {
    async function read() {
        let data = {};
        try {
            data = JSON.parse(localStorage.getItem(key)) || initialState;
        } catch (e) {
            console.error(e);
            data.errors = [e];
        }
        return hydrateFn(data);
    }
    async function write(data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
    return {
        read,
        write
    }
}
