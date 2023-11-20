export default async function TimesheetDB() {

    const dbName = "timesheet";
    const version = 2
    const request = indexedDB.open(dbName, version);
    const modules = FeedboxDB.modules.map(fn => fn());
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

function awaitEvt(x, successEvt, failureEvt, cb = (ev) => ev.target ? ev.target.result : null) {
  return new Promise((resolve, reject) => {
    x[successEvt] = function(event) { resolve(cb(event))};
    x[failureEvt] = function(event) { reject(cb(event))};
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
      // Create an feedStore to hold information about our feeds.
      const taskStore = db.createObjectStore("tasks", { autoIncrement: true });
  
      // Create an index to search tasks by external id. 
      taskStore.createIndex("exid", "exid", { unique: true });
      taskStore.createIndex("client", "client", { unique: false });
      taskStore.createIndex("project", "project", { unique: false });

      if(version == 2) {
        const transaction = db.transaction(["tasks"], "readwrite");
        const objectStore = transaction.objectStore("tasks");

        let data = {};
        try {
            const local = JSON.parse(localStorage.getItem(key)) || {};
            data = {...local}
        } catch (e) {
            console.error(e);
        }

        for (let {exid, id, ...task} of data.archivedTasks) {
            const request = objectStore.add({exid: exid || Date.now(), id: id || Date.now(), ...task});
            const id = await awaitEvt(request, 'onsuccess', 'onerror');
            console.log(`added`, id);
        }
      }
    };
    
    function init(db) {
      async function addTask({exid, id, ...data}) {
        const transaction = db.transaction(["tasks"], "readwrite");
        const objectStore = transaction.objectStore("tasks");
        const request = objectStore.add({exid: exid || Date.now(), id: id || Date.now(), ...data});
        const id = await awaitEvt(request, 'onsuccess', 'onerror');
        console.log(`added`, id)
        return id
      }
  
      async function getTask(id) {
        console.log(`getting`, id);
        const transaction = db.transaction(["tasks"], "readwrite");
        const objectStore = transaction.objectStore("tasks");
        const request = objectStore.get(id);
        const task = await awaitEvt(request, 'onsuccess', 'onerror');
        console.log(`got`, id, task);
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
  })
  