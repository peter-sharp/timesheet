import { getLinkedFiles, verifyPermission, setFileBase } from './fileSync.js';
import { taskToLine, tasksToTodoTxt, tasksToDoneTxt, parseTodoTxt } from './todoTxtFormat.js';

// Fields owned by the file; time-tracking fields (total, entries, status...) stay app-owned
const FILE_FIELDS = ['description', 'project', 'client', 'context', 'complete', 'completedDate',
    'due', 'estimate', 'priority', 'creationDate', 'metadata'];

// lastModified of each file as last read or written, keyed by file key
const _lastSeen = new Map();

const FILES = [['todoFile', 'todoHandle', 'todoBase'], ['doneFile', 'doneHandle', 'doneBase']];

/**
 * Read every linked file that already has permission (never prompts).
 * Returns { todo, done } where each is null or { key, handle, text, lastModified, base }.
 */
export async function readLinkedFiles() {
    const linked = await getLinkedFiles();
    const [todo, done] = await Promise.all(FILES.map(async ([key, handleKey, baseKey]) => {
        const handle = linked[handleKey];
        if (!handle || !await verifyPermission(handle)) return null;
        const file = await handle.getFile();
        _lastSeen.set(key, file.lastModified);
        return { key, handle, text: await file.text(), lastModified: file.lastModified, base: linked[baseKey] };
    }));
    return { todo, done };
}

/** Cheap poll: true if any accessible linked file changed since last read/write. */
export async function linkedFilesChanged() {
    const linked = await getLinkedFiles();
    for (const [key, handleKey] of FILES) {
        const handle = linked[handleKey];
        if (!handle || !await verifyPermission(handle)) continue;
        const { lastModified } = await handle.getFile();
        if (_lastSeen.get(key) !== lastModified) return true;
    }
    return false;
}

const parseDone = text => parseTodoTxt(text).map(t => ({ ...t, complete: true }));

/** Parse current file contents into one task list (done.txt tasks forced complete). */
export function parseFiles({ todo, done }) {
    return [...parseTodoTxt(todo?.text), ...parseDone(done?.text)];
}

/** Parse last-synced contents; null when no file has a base yet (first sync). */
export function parseBase({ todo, done }) {
    if (todo?.base == null && done?.base == null) return null;
    return [...parseTodoTxt(todo?.base), ...parseDone(done?.base)];
}

/** True if any file differs from its last-synced content. */
export const filesChangedExternally = ({ todo, done }) =>
    [todo, done].some(f => f && f.text !== f.base);

/** Give lines typed without a #exid a fresh one so they can be tracked. */
export function assignMissingExids(tasks, now = Date.now()) {
    let n = 0;
    return tasks.map(t => t.exid ? t : { ...t, exid: String(now + n++) });
}

const pickFileFields = task => Object.fromEntries(
    FILE_FIELDS.filter(f => task[f] !== undefined).map(f => [f, task[f]])
);

/**
 * Three-way merge plan: compares current file tasks with the last-synced base
 * so only lines actually edited outside the app are applied.
 *
 * - updates:   [{ exid, changes }] lines edited externally (file wins for FILE_FIELDS)
 * - additions: tasks in the file that the app has never seen
 * - removals:  exids whose lines were deleted from the files since the last sync
 *
 * Tasks deleted in the app are never resurrected. Without a base (first sync)
 * every file line counts as edited and nothing counts as removed.
 */
export function planInbound({ baseTasks, fileTasks, dbTasks }) {
    const baseByExid = new Map((baseTasks || []).map(t => [String(t.exid), t]));
    const dbByExid = new Map(dbTasks.map(t => [String(t.exid), t]));
    const fileExids = new Set(fileTasks.map(t => String(t.exid)));

    const updates = [];
    const additions = [];
    for (const fileTask of fileTasks) {
        const exid = String(fileTask.exid);
        const base = baseByExid.get(exid);
        if (base && taskToLine(base) === taskToLine(fileTask)) continue;
        const dbTask = dbByExid.get(exid);
        if (!dbTask) {
            additions.push(fileTask);
            continue;
        }
        if (dbTask.deleted) continue;
        const changes = pickFileFields(fileTask);
        if (dbTask.archived) changes.archived = false;
        updates.push({ exid: dbTask.exid, changes });
    }

    const removals = baseTasks
        ? [...baseByExid.keys()].filter(exid => {
            const dbTask = dbByExid.get(exid);
            return !fileExids.has(exid) && dbTask && !dbTask.deleted && !dbTask.archived;
        }).map(exid => dbByExid.get(exid).exid)
        : [];

    return { updates, additions, removals };
}

/**
 * Build file contents. A file holds the tasks already in it (kept in place)
 * plus today's tasks, rendered from the freshest app copy. Tasks deleted or
 * archived in the app drop out; lines the app doesn't know are kept verbatim.
 */
export function renderFiles({ fileTasks, viewTasks, dbTasks, doneLinked }) {
    const byExid = new Map();
    for (const t of [...fileTasks, ...dbTasks, ...viewTasks]) byExid.set(String(t.exid), t);
    const order = [...new Set([...fileTasks, ...viewTasks].map(t => String(t.exid)))];
    const tasks = order.map(exid => byExid.get(exid)).filter(t => !t.deleted && !t.archived);
    return {
        // Without a done.txt, completed tasks stay in todo.txt as "x ..." lines
        todo: doneLinked ? tasksToTodoTxt(tasks) : tasks.map(taskToLine).join('\n'),
        done: tasksToDoneTxt(tasks)
    };
}

/**
 * Write rendered contents, skipping unchanged files and aborting if a file
 * changed since it was read (returns false so the caller re-syncs).
 */
export async function writeLinkedFiles(files, content) {
    for (const name of ['todo', 'done']) {
        const file = files[name];
        if (!file) continue;
        const text = content[name];
        if (text !== file.text) {
            const { lastModified } = await file.handle.getFile();
            if (lastModified !== file.lastModified) return false;
            const writable = await file.handle.createWritable();
            await writable.write(text);
            await writable.close();
            _lastSeen.set(file.key, (await file.handle.getFile()).lastModified);
        }
        if (text !== file.base) await setFileBase(file.key, text);
    }
    return true;
}
