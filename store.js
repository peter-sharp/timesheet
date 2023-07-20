
export default function Store(key, hydrateFn, dehydrateFn, storageTypeSortFn, initialState) {
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
