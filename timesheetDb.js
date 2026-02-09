/**
 * TimesheetDB - A modular IndexedDB implementation for timesheet management
 * 
 * This module implements a modular database architecture where each module is responsible
 * for managing a specific part of the database. Modules are registered through the
 * TimesheetDB.modules array and provide both initialization and upgrade functionality.
 * 
 * Module Structure:
 * - Each module is a function that returns an object with init and upgrade methods
 * - The upgrade method handles database schema changes and data migration
 * - The init method provides database operations for that module
 * 
 * Example Usage:
 * ```javascript
 * // Initialize the database
 * const db = await TimesheetDB();
 * 
 * // Tasks module operations
 * const taskId = await db.addTask({ 
 *   client: 'Acme Corp',
 *   project: 'Website Redesign',
 *   description: 'Update homepage layout'
 * });
 * const task = await db.getTask(taskId);
 * 
 * // Entries module operations
 * const entryId = await db.addEntry({
 *   task: taskId,
 *   start: new Date(),
 *   end: new Date(),
 *   description: 'Initial layout work'
 * });
 * 
 * // Preferences module operations
 * await db.addPreference({ key: 'theme', value: 'dark' });
 * const theme = await db.getPreference('theme');
 * ```
 * 
 * Creating a New Module:
 * ```javascript
 * TimesheetDB.modules.push(function myModule() {
 *   async function upgrade(db, version) {
 *     // Create objectStore and indexes
 *     if (!db.objectStoreNames.contains("myStore")) {
 *       const store = db.createObjectStore("myStore", { keyPath: "id" });
 *       store.createIndex("name", "name", { unique: false });
 *     }
 *   }
 *   
 *   function init(db) {
 *     async function addItem(item) {
 *       const transaction = db.transaction(["myStore"], "readwrite");
 *       const store = transaction.objectStore("myStore");
 *       return await awaitEvt(store.add(item), 'onsuccess', 'onerror');
 *     }
 * 
 *     return { addItem }
 *   }
 * 
 *   return { init, upgrade }
 * });
 * ```
 * 
 * @returns {Promise<Object>} A promise that resolves to an object containing all module operations
 */
export default async function TimesheetDB() {
    const dbName = "timesheet";
    const version = 6;
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

/** Array to store registered database modules */
TimesheetDB.modules = [];

/**
 * Helper function to promisify IndexedDB events
 * @param {IDBRequest} x - The IndexedDB request object
 * @param {string} successEvt - Name of the success event
 * @param {string} failureEvt - Name of the failure event
 * @param {Function} cb - Success callback function
 * @param {Function} cbError - Error callback function
 * @returns {Promise} A promise that resolves with the event result or rejects with the error
 */
function awaitEvt(x, successEvt, failureEvt, cb = (ev) => ev.target ? ev.target.result : null, cbError = (ev) => ev.target ? ev.target.error : null) {
    return new Promise((resolve, reject) => {
        x[successEvt] = function(event) { resolve(cb(event))};
        x[failureEvt] = function(event) { reject(cbError(event))};
    });
}

/**
 * Helper function to create an async iterator for IndexedDB cursors
 * @param {IDBCursor} cursor - The IndexedDB cursor
 * @returns {Object} An async iterator object for cursor operations
 */
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

/**
 * Tasks Module - Manages task-related data in the database
 * 
 * This module handles the storage and retrieval of tasks, including:
 * - Task creation and updates
 * - Task retrieval by ID or as a list
 * - Database schema upgrades for tasks
 * - Migration of task data from localStorage (version 2)
 */
TimesheetDB.modules.push(function tasksDb() {
    /**
     * Handles database schema upgrades for the tasks module
     * @param {IDBDatabase} db - The database instance
     * @param {number} version - The new database version
     */
    async function upgrade(db, version) {
        // Create an objectStore to hold task information
        if (!db.objectStoreNames.contains("tasks")) {
            const taskStore = db.createObjectStore("tasks", { autoIncrement: true });

            // Create indexes
            taskStore.createIndex("exid", "exid", { unique: true });
            taskStore.createIndex("client", "client", { unique: false });
            taskStore.createIndex("project", "project", { unique: false });
            taskStore.createIndex("lastModified", "lastModified", { unique: false });
            taskStore.createIndex("deleted", "deleted", { unique: false });
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

            // Group tasks by exid to handle duplicates
            const tasksByExid = new Map();
            for (let {exid, id, ...task} of archivedTasks) {
                const taskExid = exid || Date.now();
                if (tasksByExid.has(taskExid)) {
                    // Merge duplicate tasks, keeping the most recent data
                    const existingTask = tasksByExid.get(taskExid);
                    tasksByExid.set(taskExid, {
                        ...existingTask,
                        ...task,
                        // Keep the most recent id
                        id: Math.max(existingTask.id, id || Date.now())
                    });
                } else {
                    tasksByExid.set(taskExid, {
                        exid: taskExid,
                        id: id || Date.now(),
                        ...task
                    });
                }
            }

            // Add merged tasks to the database
            for (const task of tasksByExid.values()) {
                try {
                    const request = objectStore.add(task);
                    await awaitEvt(request, 'onsuccess', 'onerror');
                } catch (e) {
                    if (e.name === 'ConstraintError') {
                        // If we still get a constraint error, try to update instead
                        const request = objectStore.put(task);
                        await awaitEvt(request, 'onsuccess', 'onerror');
                    } else {
                        throw e;
                    }
                }
            }
        }
    }
    
    /**
     * Initializes the tasks module with database operations
     * @param {IDBDatabase} db - The database instance
     * @returns {Object} Object containing task-related database operations
     */
    function init(db) {
        async function addTask({exid, id, ...data}) {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");
            const request = objectStore.add({
                exid: exid || Date.now(),
                id: id || Date.now(),
                ...data,
                deleted: false,
                lastModified: new Date()
            });
            const taskId = await awaitEvt(request, 'onsuccess', 'onerror');
            return taskId;
        }

        async function updateTask(task) {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");
            // Look up the auto-increment key via the exid index
            const index = objectStore.index("exid");
            const keyRequest = index.getKey(task.exid);
            const key = await awaitEvt(keyRequest, 'onsuccess', 'onerror');
            const request = objectStore.put({
                ...task,
                lastModified: new Date()
            }, key);
            const taskId = await awaitEvt(request, 'onsuccess', 'onerror');
            return taskId;
        }

        async function getTask(id) {
            const transaction = db.transaction(["tasks"], "readonly");
            const objectStore = transaction.objectStore("tasks");
            const request = objectStore.get(id);
            const task = await awaitEvt(request, 'onsuccess', 'onerror');
            return task;
        }

        // Returns only non-deleted tasks
        async function* getTasks() {
            const transaction = db.transaction(["tasks"], "readonly");
            const objectStore = transaction.objectStore("tasks");
            for await (const task of awaitCursor(objectStore.openCursor())) {
                if (!task.deleted) {
                    yield task;
                }
            }
        }

        // Soft delete - sets deleted: true instead of removing
        async function deleteTask(exid) {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");
            const index = objectStore.index("exid");
            // Get both the value and the auto-increment key
            const keyRequest = index.getKey(exid);
            const key = await awaitEvt(keyRequest, 'onsuccess', 'onerror');
            const request = index.get(exid);
            const task = await awaitEvt(request, 'onsuccess', 'onerror');
            if (task && key !== undefined) {
                const updateRequest = objectStore.put({
                    ...task,
                    deleted: true,
                    lastModified: new Date()
                }, key);
                await awaitEvt(updateRequest, 'onsuccess', 'onerror');
            }
            return task;
        }

        // Returns only deleted tasks (for restore functionality)
        async function* getDeletedTasks() {
            const transaction = db.transaction(["tasks"], "readonly");
            const objectStore = transaction.objectStore("tasks");
            for await (const task of awaitCursor(objectStore.openCursor())) {
                if (task.deleted) {
                    yield task;
                }
            }
        }

        // Restore a soft-deleted task
        async function restoreTask(exid) {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");
            const index = objectStore.index("exid");
            const keyRequest = index.getKey(exid);
            const key = await awaitEvt(keyRequest, 'onsuccess', 'onerror');
            const request = index.get(exid);
            const task = await awaitEvt(request, 'onsuccess', 'onerror');
            if (task && key !== undefined) {
                const updateRequest = objectStore.put({
                    ...task,
                    deleted: false,
                    lastModified: new Date()
                }, key);
                await awaitEvt(updateRequest, 'onsuccess', 'onerror');
            }
            return task;
        }

        // Permanently delete a task (for cleanup)
        async function permanentlyDeleteTask(exid) {
            const transaction = db.transaction(["tasks"], "readwrite");
            const objectStore = transaction.objectStore("tasks");
            const index = objectStore.index("exid");
            const request = index.getKey(exid);
            const key = await awaitEvt(request, 'onsuccess', 'onerror');
            if (key !== undefined) {
                const deleteRequest = objectStore.delete(key);
                await awaitEvt(deleteRequest, 'onsuccess', 'onerror');
            }
            return key;
        }

        // Returns only non-deleted tasks modified today
        async function* getTasksModifiedToday() {
            const transaction = db.transaction(["tasks"], "readonly");
            const objectStore = transaction.objectStore("tasks");
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            for await (const task of awaitCursor(objectStore.openCursor())) {
                if (!task.deleted &&
                    task.lastModified &&
                    task.lastModified >= today &&
                    task.lastModified < tomorrow) {
                    yield task;
                }
            }
        }

        // Returns all non-deleted tasks as array
        async function getAllTasks() {
            const tasks = [];
            for await (const task of getTasks()) {
                tasks.push(task);
            }
            return tasks;
        }

        // Returns up to `limit` most-recently-modified non-deleted tasks
        async function getRecentTasks(limit = 500) {
            const transaction = db.transaction(["tasks"], "readonly");
            const objectStore = transaction.objectStore("tasks");
            const index = objectStore.index("lastModified");
            const tasks = [];
            // Walk the index in reverse (newest first)
            for await (const task of awaitCursor(index.openCursor(null, "prev"))) {
                if (!task.deleted) {
                    tasks.push(task);
                    if (tasks.length >= limit) break;
                }
            }
            return tasks;
        }

        return {
            addTask,
            updateTask,
            getTask,
            getTasks,
            deleteTask,
            getDeletedTasks,
            restoreTask,
            permanentlyDeleteTask,
            getTasksModifiedToday,
            getAllTasks,
            getRecentTasks
        }
    }

    return {
        init,
        upgrade
    }
});

/**
 * Entries Module - Manages time entries in the database
 * 
 * This module handles the storage and retrieval of time entries, including:
 * - Entry creation and updates
 * - Entry retrieval by ID or as a list
 * - Database schema upgrades for entries
 * - Migration of entry data from localStorage (version 3)
 */
TimesheetDB.modules.push(function entriesDb() {
    /**
     * Handles database schema upgrades for the entries module
     * @param {IDBDatabase} db - The database instance
     * @param {number} version - The new database version
     */
    async function upgrade(db, version) {
        // Create an objectStore to hold entry information
        if (!db.objectStoreNames.contains("entries")) {
            const entryStore = db.createObjectStore("entries", { autoIncrement: true });

            // Create indexes
            entryStore.createIndex("id", "id", { unique: true });
            entryStore.createIndex("task", "task", { unique: false });
            entryStore.createIndex("start", "start", { unique: false });
            entryStore.createIndex("lastModified", "lastModified", { unique: false });
            entryStore.createIndex("deleted", "deleted", { unique: false });
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
    
    /**
     * Initializes the entries module with database operations
     * @param {IDBDatabase} db - The database instance
     * @returns {Object} Object containing entry-related database operations
     */
    function init(db) {
        async function addEntry(entry) {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");
            const request = objectStore.add({
                ...entry,
                id: entry.id || Date.now(),
                start: new Date(entry.start),
                end: new Date(entry.end),
                deleted: false,
                lastModified: new Date()
            });
            const entryId = await awaitEvt(request, 'onsuccess', 'onerror');
            return entryId;
        }

        async function updateEntry(entry) {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");
            // Look up the auto-increment key via the id index
            const index = objectStore.index("id");
            const keyRequest = index.getKey(entry.id);
            const key = await awaitEvt(keyRequest, 'onsuccess', 'onerror');
            const request = objectStore.put({
                ...entry,
                start: new Date(entry.start),
                end: new Date(entry.end),
                lastModified: new Date()
            }, key);
            const entryId = await awaitEvt(request, 'onsuccess', 'onerror');
            return entryId;
        }

        async function getEntry(id) {
            const transaction = db.transaction(["entries"], "readonly");
            const objectStore = transaction.objectStore("entries");
            const request = objectStore.get(id);
            const entry = await awaitEvt(request, 'onsuccess', 'onerror');
            return entry;
        }

        // Returns only non-deleted entries
        async function* getEntries() {
            const transaction = db.transaction(["entries"], "readonly");
            const objectStore = transaction.objectStore("entries");
            for await (const entry of awaitCursor(objectStore.openCursor())) {
                if (!entry.deleted) {
                    yield entry;
                }
            }
        }

        // Soft delete - sets deleted: true instead of removing
        async function deleteEntry(id) {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");
            const index = objectStore.index("id");
            // Get both the value and the auto-increment key
            const keyRequest = index.getKey(id);
            const key = await awaitEvt(keyRequest, 'onsuccess', 'onerror');
            const request = index.get(id);
            const entry = await awaitEvt(request, 'onsuccess', 'onerror');
            if (entry && key !== undefined) {
                const updateRequest = objectStore.put({
                    ...entry,
                    deleted: true,
                    lastModified: new Date()
                }, key);
                await awaitEvt(updateRequest, 'onsuccess', 'onerror');
            }
            return entry;
        }

        // Returns only deleted entries (for restore functionality)
        async function* getDeletedEntries() {
            const transaction = db.transaction(["entries"], "readonly");
            const objectStore = transaction.objectStore("entries");
            for await (const entry of awaitCursor(objectStore.openCursor())) {
                if (entry.deleted) {
                    yield entry;
                }
            }
        }

        // Restore a soft-deleted entry
        async function restoreEntry(id) {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");
            const index = objectStore.index("id");
            const keyRequest = index.getKey(id);
            const key = await awaitEvt(keyRequest, 'onsuccess', 'onerror');
            const request = index.get(id);
            const entry = await awaitEvt(request, 'onsuccess', 'onerror');
            if (entry && key !== undefined) {
                const updateRequest = objectStore.put({
                    ...entry,
                    deleted: false,
                    lastModified: new Date()
                }, key);
                await awaitEvt(updateRequest, 'onsuccess', 'onerror');
            }
            return entry;
        }

        // Permanently delete an entry (for cleanup)
        async function permanentlyDeleteEntry(id) {
            const transaction = db.transaction(["entries"], "readwrite");
            const objectStore = transaction.objectStore("entries");
            const index = objectStore.index("id");
            const request = index.getKey(id);
            const key = await awaitEvt(request, 'onsuccess', 'onerror');
            if (key !== undefined) {
                const deleteRequest = objectStore.delete(key);
                await awaitEvt(deleteRequest, 'onsuccess', 'onerror');
            }
            return key;
        }

        // Returns only non-deleted entries modified today
        async function* getEntriesModifiedToday() {
            const transaction = db.transaction(["entries"], "readonly");
            const objectStore = transaction.objectStore("entries");
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            for await (const entry of awaitCursor(objectStore.openCursor())) {
                if (!entry.deleted &&
                    entry.lastModified &&
                    entry.lastModified >= today &&
                    entry.lastModified < tomorrow) {
                    yield entry;
                }
            }
        }

        // Returns all non-deleted entries as array
        async function getAllEntries() {
            const entries = [];
            for await (const entry of getEntries()) {
                entries.push(entry);
            }
            return entries;
        }

        return {
            addEntry,
            updateEntry,
            getEntry,
            getEntries,
            deleteEntry,
            getDeletedEntries,
            restoreEntry,
            permanentlyDeleteEntry,
            getEntriesModifiedToday,
            getAllEntries
        }
    }

    return {
        init,
        upgrade
    }
});

/**
 * File Handles Module - Stores FileSystemFileHandle objects for todo.txt sync
 */
TimesheetDB.modules.push(function fileHandlesDb() {
    async function upgrade(db, version) {
        if (!db.objectStoreNames.contains("fileHandles")) {
            db.createObjectStore("fileHandles", { keyPath: "key" });
        }
    }

    function init(db) {
        async function putFileHandle(key, handle, fileName) {
            const transaction = db.transaction(["fileHandles"], "readwrite");
            const store = transaction.objectStore("fileHandles");
            const request = store.put({ key, handle, fileName, linkedAt: new Date() });
            return await awaitEvt(request, 'onsuccess', 'onerror');
        }

        async function getFileHandle(key) {
            const transaction = db.transaction(["fileHandles"], "readonly");
            const store = transaction.objectStore("fileHandles");
            const request = store.get(key);
            return await awaitEvt(request, 'onsuccess', 'onerror');
        }

        async function deleteFileHandle(key) {
            const transaction = db.transaction(["fileHandles"], "readwrite");
            const store = transaction.objectStore("fileHandles");
            const request = store.delete(key);
            return await awaitEvt(request, 'onsuccess', 'onerror');
        }

        return { putFileHandle, getFileHandle, deleteFileHandle };
    }

    return { init, upgrade };
});
