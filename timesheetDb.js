export default async function TimesheetDB() {
    const dbName = "timesheet";
    const version = 3;
    const request = indexedDB.open(dbName, version);
    const modules = TimesheetDB.modules.map(fn => fn());
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
    
        modules.forEach(({upgrade}) => {
            upgrade(db, version);
        })
    };
    
    const db = await awaitEvt(request, 'onsuccess', 'onerror');
    return modules.reduce((acc, {init}) => ({...acc, ...init(db)}), {})    
}

TimesheetDB.modules = [];

function awaitEvt(x, successEvt, failureEvt, cb = (ev) => ev.target ? ev.target.result : null, cbError = (ev) => ev.target ? ev.target.error : null) {
    return new Promise((resolve, reject) => {
        x[successEvt] = function(event) { resolve(cb(event))};
        x[failureEvt] = function(event) { reject(cbError(event))};
    });
}

function awaitCursor(cursor) {
    let cur = cursor;
    let push = (x) => {} 
    cur.onsuccess = function step(ev) {
        cur = ev.target.result;
        if(cur) {
            push({done: false, value: cur.value});
        } else {
            push({done: true});
        } 
    }

    cur.onerror = function log(ev) {
        console.error(ev);
    }
    return {
        [Symbol.asyncIterator] () {
            return {
                next() {
                    return new Promise((resolve, reject) => {
                        push = resolve;
                        if(cur?.continue) cur.continue();
                    });
                },
                return() {
                    console.log("Closing");
                    return Promise.resolve({ done: true });
                },
            };
        },
    }
}

TimesheetDB.modules.push(function tasksDb() {
    async function upgrade(db, version) {
        // Create an objectStore to hold task information
        if (!db.objectStoreNames.contains("tasks")) {
            const taskStore = db.createObjectStore("tasks", { autoIncrement: true });
            
            // Create indexes
            taskStore.createIndex("exid", "exid", { unique: true });
            taskStore.createIndex("client", "client", { unique: false });
            taskStore.createIndex("project", "project", { unique: false });
        }

        if (version >= 2) {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");

            let data = {};
            try {
                const local = JSON.parse(localStorage.getItem('timesheet')) || {};
                data = {...local}
            } catch (e) {
                console.error(e);
            }

            // Handle both old and new archive structures
            const archivedTasks = Array.isArray(data.archivedTasks) ? data.archivedTasks : 
                                (data.archive?.tasks || []);

            for (let {exid, id, ...task} of archivedTasks) {
                const request = objectStore.add({exid: exid || Date.now(), id: id || Date.now(), ...task});
                await awaitEvt(request, 'onsuccess', 'onerror');
            }
        }
    }
    
    function init(db) {
        async function addTask({exid, id, ...data}) {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");
            const request = objectStore.add({exid: exid || Date.now(), id: id || Date.now(), ...data});
            const taskId = await awaitEvt(request, 'onsuccess', 'onerror');
            return taskId;
        }
    
        async function getTask(id) {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");
            const request = objectStore.get(id);
            const task = await awaitEvt(request, 'onsuccess', 'onerror');
            return task;
        }
    
        async function* getTasks() {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");
            yield* awaitCursor(objectStore.openCursor());
        }

        return {
            addTask,
            getTask,
            getTasks
        }
    }

    return {
        init,
        upgrade
    }
});

TimesheetDB.modules.push(function entriesDb() {
    async function upgrade(db, version) {
        // Create an objectStore to hold entry information
        if (!db.objectStoreNames.contains("entries")) {
            const entryStore = db.createObjectStore("entries", { autoIncrement: true });
            
            // Create indexes
            entryStore.createIndex("id", "id", { unique: true });
            entryStore.createIndex("task", "task", { unique: false });
            entryStore.createIndex("start", "start", { unique: false });
        }

        if (version >= 3) {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");

            let data = {};
            try {
                const local = JSON.parse(localStorage.getItem('timesheet')) || {};
                data = {...local}
            } catch (e) {
                console.error(e);
            }

            // Handle both old and new archive structures
            const archivedEntries = Array.isArray(data.archive) ? data.archive : 
                                  (data.archive?.entries || []);

            for (let entry of archivedEntries) {
                const request = objectStore.add({
                    ...entry,
                    start: new Date(entry.start),
                    end: new Date(entry.end)
                });
                await awaitEvt(request, 'onsuccess', 'onerror');
            }
        }
    }
    
    function init(db) {
        async function addEntry(entry) {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");
            const request = objectStore.add({
                ...entry,
                start: new Date(entry.start),
                end: new Date(entry.end)
            });
            const entryId = await awaitEvt(request, 'onsuccess', 'onerror');
            return entryId;
        }
    
        async function getEntry(id) {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");
            const request = objectStore.get(id);
            const entry = await awaitEvt(request, 'onsuccess', 'onerror');
            return entry;
        }
    
        async function* getEntries() {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");
            yield* awaitCursor(objectStore.openCursor());
        }

        return {
            addEntry,
            getEntry,
            getEntries
        }
    }

    return {
        init,
        upgrade
    }
});
  