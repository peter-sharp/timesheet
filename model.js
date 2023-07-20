/**
 * Creates model with given functions and state
 * @param fns reducers to update business logic
 * @param initialState initial state of model
 **/
export function Model(fns, initialState) {
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
        get state() {
            return {...state}
        },
        emit,
        listen
    }
}
