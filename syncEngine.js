import { getLinkedFiles, readFile, writeFile, verifyPermission } from './fileSync.js';
import { tasksToTodoTxt, tasksToDoneTxt, parseTodoTxt } from './todoTxtFormat.js';
import TimesheetDB from './timesheetDb.js';

let _pendingOutbound = null;

/**
 * Merge file tasks into app tasks by exid.
 * - File-only tasks: added to app
 * - Both: file wins for text fields, app wins for time-tracking fields
 * - App-only tasks: kept (no data loss)
 */
export function mergeTasks(appTasks, fileTasks) {
    const merged = new Map();

    for (const task of appTasks) {
        merged.set(task.exid, { ...task });
    }

    for (const fileTask of fileTasks) {
        if (!fileTask.exid) continue;
        const existing = merged.get(fileTask.exid);
        if (!existing) {
            merged.set(fileTask.exid, {
                ...fileTask,
                id: Date.now(),
                lastModified: new Date(),
                deleted: false
            });
        } else {
            merged.set(fileTask.exid, {
                ...existing,
                description: fileTask.description,
                project: fileTask.project,
                client: fileTask.client,
                complete: fileTask.complete,
                due: fileTask.due,
                estimate: fileTask.estimate,
                context: fileTask.context,
                ...(fileTask.metadata ? { metadata: fileTask.metadata } : {}),
                lastModified: new Date()
            });
        }
    }

    return [...merged.values()];
}

/**
 * Schedule outbound sync via requestIdleCallback.
 * Cancels any pending callback to coalesce rapid edits.
 */
export function syncOutbound(tasks) {
    if (_pendingOutbound !== null) {
        cancelIdleCallback(_pendingOutbound);
    }
    _pendingOutbound = requestIdleCallback(async () => {
        _pendingOutbound = null;
        try {
            await _doOutbound(tasks);
        } catch (e) {
            console.warn('File sync outbound failed:', e);
        }
    });
}

async function _doOutbound(tasks) {
    const { todoHandle, doneHandle } = await getLinkedFiles();
    if (!todoHandle && !doneHandle) return;

    if (todoHandle && await verifyPermission(todoHandle)) {
        const content = tasksToTodoTxt(tasks);
        await writeFile(todoHandle, content);
    }

    if (doneHandle && await verifyPermission(doneHandle)) {
        const content = tasksToDoneTxt(tasks);
        await writeFile(doneHandle, content);
    }
}

/**
 * Filter file tasks to only those relevant for today's in-memory view.
 *
 * Exported for unit testing. Used by syncInbound before calling mergeTasks.
 *
 * @param {Array}  fileTasks      - Tasks parsed from the linked file
 * @param {Set}    appTaskExids   - exids of tasks already in today's view
 * @param {Set}    dbTaskExids    - exids of ALL tasks currently in the DB (any date)
 * @returns {Array} filtered file tasks
 */
export function filterRelevantFileTasks(fileTasks, appTaskExids, dbTaskExids) {
    return fileTasks.filter(ft =>
        !ft.exid ||                      // no exid: can't deduplicate, let through
        appTaskExids.has(ft.exid) ||     // already in today's view: update metadata
        !dbTaskExids.has(ft.exid)        // genuinely new: not yet in DB
    );
}

/**
 * Read linked files and merge into app tasks.
 * Returns merged array, or null if no files are linked.
 *
 * Only file tasks that are already in today's appTasks (for metadata updates)
 * or are genuinely new (not yet in the DB) are merged into the result.
 * This prevents stale file tasks from bypassing the daily rollover — after
 * rollover appTasks is empty, so without this guard every file task would get
 * lastModified: new Date() and reappear in today's view.
 */
export async function syncInbound(appTasks) {
    const { todoHandle, doneHandle } = await getLinkedFiles();
    if (!todoHandle && !doneHandle) return null;

    let fileTasks = [];

    if (todoHandle && await verifyPermission(todoHandle)) {
        const text = await readFile(todoHandle);
        fileTasks = fileTasks.concat(parseTodoTxt(text));
    }

    if (doneHandle && await verifyPermission(doneHandle)) {
        const text = await readFile(doneHandle);
        const doneTasks = parseTodoTxt(text);
        // Ensure all done.txt tasks are marked complete
        fileTasks = fileTasks.concat(doneTasks.map(t => ({ ...t, complete: true })));
    }

    if (fileTasks.length === 0 && !todoHandle) return null;

    // Build a set of exids for tasks already in today's view.
    const appTaskExids = new Set(appTasks.map(t => t.exid));

    // Build a set of all exids that exist in the DB (any date).
    // Tasks that are in the file, exist in the DB, but are NOT in today's view
    // are old tasks from a previous day — skip them so they don't reappear.
    const db = await TimesheetDB();
    const allDbTasks = await db.getAllTasks();
    const dbTaskExids = new Set(allDbTasks.map(t => t.exid));

    const relevantFileTasks = filterRelevantFileTasks(fileTasks, appTaskExids, dbTaskExids);

    return mergeTasks(appTasks, relevantFileTasks);
}
