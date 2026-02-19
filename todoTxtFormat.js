import extract from './utils/extract.js';

const COMPLETION_RE = /^x\s+(\d{4}-\d{2}-\d{2})\s+/;

// Maps from todo.txt state tag values to Title Case state enum values
const STATE_TAG_TO_ENUM = {
    'in-progress': 'In Progress',
    'on-hold': 'On Hold',
};

// Maps from Title Case state enum values to todo.txt state tag values
const STATE_ENUM_TO_TAG = {
    'In Progress': 'in-progress',
    'On Hold': 'on-hold',
};

export function taskToLine(task) {
    const parts = [];
    if (task.exid) parts.push(`#${task.exid}`);
    if (task.description) parts.push(task.description);
    if (task.project) parts.push(`+${task.project}`);
    if (task.context) parts.push(`@${task.context}`);
    if (task.client) parts.push(`client:${task.client}`);
    if (task.due) parts.push(`due:${task.due}`);
    if (task.estimate) parts.push(`estimate:${task.estimate}`);
    // Add state tag for non-default states (not started and complete are handled externally)
    if (task.state && STATE_ENUM_TO_TAG[task.state]) {
        parts.push(`state:${STATE_ENUM_TO_TAG[task.state]}`);
    }
    // Add any additional metadata
    if (task.metadata && typeof task.metadata === 'object') {
        Object.entries(task.metadata).forEach(([key, value]) => {
            if (value) parts.push(`${key}:${value}`);
        });
    }
    const line = parts.join(' ');
    if (task.state === 'Complete') {
        const date = task.completedDate || new Date().toISOString().slice(0, 10);
        return `x ${date} ${line}`;
    }
    return line;
}

export function lineToTask(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let state = 'Not Started';
    let completedDate = undefined;
    let remainder = trimmed;

    const match = trimmed.match(COMPLETION_RE);
    if (match) {
        state = 'Complete';
        completedDate = match[1];
        remainder = trimmed.slice(match[0].length);
    }

    const [exid, project, context, client, due, estimate, description] = extract(
        [/#(\w+)/, /\+(\S+)/, /@(\S+)/, /\bclient:(\w+)/, /\bdue:(\S+)/, /\bestimate:(\S+)/],
        remainder
    );

    // Extract any additional key:value metadata and clean description
    const metadata = {};
    const knownKeys = new Set(['client', 'due', 'estimate', 'state']);
    const metadataPattern = /\b(\w+):(\S+)/g;
    let metaMatch;
    let cleanDescription = description || '';

    while ((metaMatch = metadataPattern.exec(description || '')) !== null) {
        const key = metaMatch[1];
        const value = metaMatch[2];

        // Handle state tag: map to enum value
        if (key === 'state' && state !== 'Complete') {
            state = STATE_TAG_TO_ENUM[value] || 'Not Started';
        }

        // Collect unknown metadata (exclude known keys including state)
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
        state,
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
        .filter(t => t.state !== 'Complete' && !t.deleted)
        .map(taskToLine)
        .join('\n');
}

export function tasksToDoneTxt(tasks) {
    return tasks
        .filter(t => t.state === 'Complete' && !t.deleted)
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
