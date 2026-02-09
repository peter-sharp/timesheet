import extract from './utils/extract.js';

const COMPLETION_RE = /^x\s+(\d{4}-\d{2}-\d{2})\s+/;

export function taskToLine(task) {
    const parts = [];
    if (task.exid) parts.push(`#${task.exid}`);
    if (task.description) parts.push(task.description);
    if (task.project) parts.push(`+${task.project}`);
    if (task.client) parts.push(`client:${task.client}`);
    const line = parts.join(' ');
    if (task.complete) {
        const date = task.completedDate || new Date().toISOString().slice(0, 10);
        return `x ${date} ${line}`;
    }
    return line;
}

export function lineToTask(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let complete = false;
    let completedDate = undefined;
    let remainder = trimmed;

    const match = trimmed.match(COMPLETION_RE);
    if (match) {
        complete = true;
        completedDate = match[1];
        remainder = trimmed.slice(match[0].length);
    }

    const [exid, project, client, description] = extract(
        [/#(\w+)/, /\+(\w+)/, /client:(\w+)/],
        remainder
    );

    return {
        exid: exid || undefined,
        description: description ? description.trim() : '',
        project: project || '',
        client: client || '',
        complete,
        completedDate
    };
}

export function tasksToTodoTxt(tasks) {
    return tasks
        .filter(t => !t.complete && !t.deleted)
        .map(taskToLine)
        .join('\n');
}

export function tasksToDoneTxt(tasks) {
    return tasks
        .filter(t => t.complete && !t.deleted)
        .map(taskToLine)
        .join('\n');
}

export function parseTodoTxt(text) {
    if (!text) return [];
    return text
        .split('\n')
        .map(lineToTask)
        .filter(Boolean);
}
