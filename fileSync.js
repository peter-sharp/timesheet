import TimesheetDB from './timesheetDb.js';

export const isSupported = typeof window.showOpenFilePicker === 'function';

export async function pickFile(description = 'Text file') {
    const [handle] = await window.showOpenFilePicker({
        types: [{
            description,
            accept: { 'text/plain': ['.txt'] }
        }]
    });
    return handle;
}

export async function readFile(handle) {
    const file = await handle.getFile();
    return await file.text();
}

export async function writeFile(handle, content) {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
}

export async function verifyPermission(handle) {
    const opts = { mode: 'readwrite' };
    if (await handle.queryPermission(opts) === 'granted') return true;
    if (await handle.requestPermission(opts) === 'granted') return true;
    return false;
}

let _db;
async function getDb() {
    if (!_db) _db = await TimesheetDB();
    return _db;
}

export async function storeHandle(key, handle, fileName) {
    const db = await getDb();
    return db.putFileHandle(key, handle, fileName);
}

export async function retrieveHandle(key) {
    const db = await getDb();
    return db.getFileHandle(key);
}

export async function removeHandle(key) {
    const db = await getDb();
    return db.deleteFileHandle(key);
}

export async function getLinkedFiles() {
    const db = await getDb();
    const todo = await db.getFileHandle('todoFile');
    const done = await db.getFileHandle('doneFile');
    return {
        todoHandle: todo?.handle || null,
        todoFileName: todo?.fileName || null,
        doneHandle: done?.handle || null,
        doneFileName: done?.fileName || null
    };
}
