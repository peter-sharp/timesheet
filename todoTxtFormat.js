import extract from './utils/extract.js';

const COMPLETION_RE = /^x\s+(\d{4}-\d{2}-\d{2})\s+/;
// todo.txt priority: a single uppercase letter in parentheses at the start of an incomplete task
const PRIORITY_RE = /^\(([A-Z])\)\s+/;
// Optional creation date immediately following priority (or at line start if no priority)
const CREATION_DATE_RE = /^(\d{4}-\d{2}-\d{2})\s+/;

export function taskToLine(task) {
    const parts = [];
    // TODO: add UI to set/clear priority (A–Z) on a task
    if (task.priority) parts.push(`(${task.priority})`);
    // TODO: auto-set creationDate when a task is first created
    if (task.creationDate) parts.push(task.creationDate);
    if (task.exid) parts.push(`#${task.exid}`);
    if (task.description) parts.push(task.description);
    if (task.project) parts.push(`+${task.project}`);
    if (task.context) parts.push(`@${task.context}`);
    if (task.client) parts.push(`client:${task.client}`);
    if (task.due) parts.push(`due:${task.due}`);
    if (task.estimate) parts.push(`estimate:${task.estimate}`);
    // Add any additional metadata
    if (task.metadata && typeof task.metadata === 'object') {
        Object.entries(task.metadata).forEach(([key, value]) => {
            if (value) parts.push(`${key}:${value}`);
        });
    }
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
    let priority = undefined;
    let creationDate = undefined;
    let remainder = trimmed;

    const completionMatch = trimmed.match(COMPLETION_RE);
    if (completionMatch) {
        complete = true;
        completedDate = completionMatch[1];
        remainder = trimmed.slice(completionMatch[0].length);
    }

    // Priority only applies to incomplete tasks per the todo.txt spec
    if (!complete) {
        const priorityMatch = remainder.match(PRIORITY_RE);
        if (priorityMatch) {
            priority = priorityMatch[1];
            remainder = remainder.slice(priorityMatch[0].length);
        }
    }

    // Creation date comes after priority (or at line start if no priority)
    const creationDateMatch = remainder.match(CREATION_DATE_RE);
    if (creationDateMatch) {
        creationDate = creationDateMatch[1];
        remainder = remainder.slice(creationDateMatch[0].length);
    }

    const [exid, project, context, client, due, estimate, description] = extract(
        [/#(\w+)/, /\+(\S+)/, /@(\S+)/, /\bclient:(\w+)/, /\bdue:(\S+)/, /\bestimate:(\S+)/],
        remainder
    );

    // Extract any additional key:value metadata and clean description
    const metadata = {};
    const knownKeys = new Set(['client', 'due', 'estimate']);
    const metadataPattern = /\b(\w+):(\S+)/g;
    let metaMatch;
    let cleanDescription = description || '';

    while ((metaMatch = metadataPattern.exec(description || '')) !== null) {
        const key = metaMatch[1];
        const value = metaMatch[2];

        // Collect unknown metadata
        if (!knownKeys.has(key)) {
            metadata[key] = value;
        }

        // Remove ALL key:value patterns from description (both known and unknown)
        cleanDescription = cleanDescription.replace(metaMatch[0], '');
    }

    const task = {
        exid: exid || undefined,
        description: cleanDescription.trim().replace(/\s+/g, ' '),
        project: project || '',
        context: context || '',
        client: client || '',
        due: due || '',
        estimate: estimate || '',
        complete,
        completedDate,
        priority,
        creationDate
    };

    // Only add metadata field if there are additional metadata entries
    if (Object.keys(metadata).length > 0) {
        task.metadata = metadata;
    }

    return task;
}

export function tasksToTodoTxt(tasks) {
    return tasks
        .filter(t => !t.complete && !t.deleted && !t.archived)
        .map(taskToLine)
        .join('\n');
}

export function tasksToDoneTxt(tasks) {
    return tasks
        .filter(t => t.complete && !t.deleted && !t.archived)
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
