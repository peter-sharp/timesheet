/**
 * Creates model with given functions and state
 * @param fns reducers to update business logic
 * @param initialState initial state of model
 **/
export function Model(fns, initialState) {
    let reducers = fns || [];
    let state = { ...initialState };
    console.log(initialState, state)
    const listeners = [];
    function emit(ev) {
        state = reducers.reduce((s, fn) => fn(s, ev), state)
        listeners.forEach(fn => fn({ ...state }));
    }

    function use(fns, initialState) {
        reducers = [...reducers, ...fns]
        state = { ...state, ...initialState };
    }

    function listen(fn) {
        listeners.push(fn);
    }
    return {
        get state() {
            return {...state}
        },
        use,
        emit,
        listen
    }
}
