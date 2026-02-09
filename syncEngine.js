import { getLinkedFiles, readFile, writeFile, verifyPermission } from './fileSync.js';
import { tasksToTodoTxt, tasksToDoneTxt, parseTodoTxt } from './todoTxtFormat.js';

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
 * Read linked files and merge into app tasks.
 * Returns merged array, or null if no files are linked.
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

    return mergeTasks(appTasks, fileTasks);
}
