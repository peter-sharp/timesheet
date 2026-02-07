/**
 * Creates model with given functions and state
 * @param reducers reducers to update business logic
 * @param initialState initial state of model
 **/
export function Model(reducers = [], initialState = {}) {
    let state = initialState;
    const listeners = [];

    async function emit(ev) {
        let newState = {...state};
        for (const reducer of reducers) {
            newState = await reducer(newState, ev);
        }
        state = newState;
        for (const listener of listeners) {
            await listener(state);
        }
    }

    function listen(fn) {
        listeners.push(fn);
    }

    function use(newReducers) {
        reducers.push(...newReducers);
    }

    return {
        emit,
        listen,
        use,
        get state() {
            return state;
        }
    };
}
