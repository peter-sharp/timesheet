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

export function Store(key, hydrateFn, dehydrateFn, storageTypeSortFn, initialState) {
    async function read() {
        let data = {};
        try {
            const local = JSON.parse(localStorage.getItem(key)) || {};
            const session = JSON.parse(sessionStorage.getItem(key)) || {};
            data = {...local, ...session}
        } catch (e) {
            console.error(e);
            data.errors = [e];
        }
        return hydrateFn({...initialState, ...data});
    }
    async function write(data) {
        const {session, local} = storageTypeSortFn(dehydrateFn(data));
        localStorage.setItem(key, JSON.stringify(local));
        sessionStorage.setItem(key, JSON.stringify(session));
    }
    return {
        read,
        write
    }
}
