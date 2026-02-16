import extract from './utils/extract.js';

const COMPLETION_RE = /^x\s+(\d{4}-\d{2}-\d{2})\s+/;

export function taskToLine(task) {
    const parts = [];
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
    let remainder = trimmed;

    const match = trimmed.match(COMPLETION_RE);
    if (match) {
        complete = true;
        completedDate = match[1];
        remainder = trimmed.slice(match[0].length);
    }

    const [exid, project, context, client, due, estimate, description] = extract(
        [/#(\w+)/, /\+(\S+)/, /@(\S+)/, /\bclient:(\w+)/, /\bdue:(\S+)/, /\bestimate:(\S+)/],
        remainder
    );

    // Extract any additional key:value metadata
    const metadata = {};
    const knownKeys = new Set(['client', 'due', 'estimate']);
    const metadataPattern = /\b(\w+):(\S+)/g;
    let metaMatch;
    let cleanDescription = description || '';

    while ((metaMatch = metadataPattern.exec(description || '')) !== null) {
        const key = metaMatch[1];
        const value = metaMatch[2];
        if (!knownKeys.has(key)) {
            metadata[key] = value;
            // Remove this metadata from description
            cleanDescription = cleanDescription.replace(metaMatch[0], '');
        }
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
        completedDate
    };

    // Only add metadata field if there are additional metadata entries
    if (Object.keys(metadata).length > 0) {
        task.metadata = metadata;
    }

    return task;
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
