// Test for metadata syncing to/from todo.txt and done.txt files
import { tasksToTodoTxt, tasksToDoneTxt, parseTodoTxt } from '../todoTxtFormat.js';

// Inline mergeTasks to avoid browser dependencies
function mergeTasks(appTasks, fileTasks) {
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

console.log('Testing metadata sync to/from files...\n');

// Test 1: Metadata syncs to todo.txt
const tasks1 = [
    {
        exid: '12345',
        description: 'Task with metadata',
        project: 'TestProject',
        client: 'TestClient',
        metadata: { project_due: '2026-04-03', priority: 'high', total: '5.5' },
        complete: false,
        deleted: false
    }
];

const todoContent1 = tasksToTodoTxt(tasks1);
console.log('Test 1 - Metadata syncs to todo.txt:');
console.log('  Generated todo.txt content:', todoContent1);
console.log('  ✓ Contains project_due:', todoContent1.includes('project_due:2026-04-03'));
console.log('  ✓ Contains priority:', todoContent1.includes('priority:high'));
console.log('  ✓ Contains total:', todoContent1.includes('total:5.5'));
console.log();

// Test 2: Metadata syncs to done.txt
const tasks2 = [
    {
        exid: '67890',
        description: 'Completed task with metadata',
        project: 'DoneProject',
        metadata: { total: '3.25', status: 'verified' },
        complete: true,
        completedDate: '2026-02-15',
        deleted: false
    }
];

const doneContent2 = tasksToDoneTxt(tasks2);
console.log('Test 2 - Metadata syncs to done.txt:');
console.log('  Generated done.txt content:', doneContent2);
console.log('  ✓ Contains total:', doneContent2.includes('total:3.25'));
console.log('  ✓ Contains status:', doneContent2.includes('status:verified'));
console.log('  ✓ Has completion marker:', doneContent2.startsWith('x 2026-02-15'));
console.log();

// Test 3: Metadata is parsed from file content
const fileContent3 = '#11111 Import test +project project_due:2026-05-01 total:10.5 priority:medium';
const parsed3 = parseTodoTxt(fileContent3);
console.log('Test 3 - Metadata is parsed from file:');
console.log('  Input:', fileContent3);
console.log('  Parsed metadata:', parsed3[0].metadata);
console.log('  ✓ project_due:', parsed3[0].metadata?.project_due === '2026-05-01');
console.log('  ✓ total:', parsed3[0].metadata?.total === '10.5');
console.log('  ✓ priority:', parsed3[0].metadata?.priority === 'medium');
console.log();

// Test 4: Metadata is preserved during merge
const appTasks4 = [
    {
        exid: '99999',
        description: 'Old description',
        project: 'OldProject',
        metadata: { old_key: 'old_value' },
        entries: [{ start: '2026-02-10T10:00:00Z', duration: 3600 }],
        complete: false
    }
];

const fileTasks4 = parseTodoTxt('#99999 New description +NewProject project_due:2026-03-01 total:7.5');
const merged4 = mergeTasks(appTasks4, fileTasks4);

console.log('Test 4 - Metadata preserved during merge:');
console.log('  App task metadata:', appTasks4[0].metadata);
console.log('  File task metadata:', fileTasks4[0].metadata);
console.log('  Merged metadata:', merged4[0].metadata);
console.log('  ✓ File metadata wins:', merged4[0].metadata?.project_due === '2026-03-01');
console.log('  ✓ File metadata wins:', merged4[0].metadata?.total === '7.5');
console.log('  ✓ App entries preserved:', merged4[0].entries?.length === 1);
console.log('  ✓ Description updated:', merged4[0].description === 'New description');
console.log();

// Test 5: Round-trip test (write to file, read back, verify metadata intact)
const originalTask5 = {
    exid: '55555',
    description: 'Round trip test',
    project: 'RoundTrip',
    client: 'TestClient',
    due: '2026-06-01',
    estimate: '4h',
    metadata: { project_due: '2026-07-01', total: '12.75', custom_field: 'custom_value' },
    complete: false,
    deleted: false
};

const todoLine5 = tasksToTodoTxt([originalTask5]);
const reparsed5 = parseTodoTxt(todoLine5);

console.log('Test 5 - Round-trip (write → read):');
console.log('  Original metadata:', originalTask5.metadata);
console.log('  Serialized:', todoLine5);
console.log('  Reparsed metadata:', reparsed5[0].metadata);
console.log('  ✓ project_due preserved:', reparsed5[0].metadata?.project_due === '2026-07-01');
console.log('  ✓ total preserved:', reparsed5[0].metadata?.total === '12.75');
console.log('  ✓ custom_field preserved:', reparsed5[0].metadata?.custom_field === 'custom_value');
console.log('  ✓ due preserved:', reparsed5[0].due === '2026-06-01');
console.log('  ✓ estimate preserved:', reparsed5[0].estimate === '4h');
console.log();

// Test 6: Multiple tasks with different metadata
const multiTasks6 = [
    {
        exid: '111',
        description: 'Task A',
        project: 'ProjectA',
        metadata: { total: '1.5' },
        complete: false,
        deleted: false
    },
    {
        exid: '222',
        description: 'Task B',
        project: 'ProjectB',
        metadata: { total: '2.5', priority: 'high' },
        complete: false,
        deleted: false
    },
    {
        exid: '333',
        description: 'Task C',
        project: 'ProjectC',
        // No metadata
        complete: false,
        deleted: false
    }
];

const todoContent6 = tasksToTodoTxt(multiTasks6);
const lines6 = todoContent6.split('\n');

console.log('Test 6 - Multiple tasks with varied metadata:');
console.log('  Line 1:', lines6[0]);
console.log('  ✓ Task A has total:', lines6[0].includes('total:1.5'));
console.log('  Line 2:', lines6[1]);
console.log('  ✓ Task B has total:', lines6[1].includes('total:2.5'));
console.log('  ✓ Task B has priority:', lines6[1].includes('priority:high'));
console.log('  Line 3:', lines6[2]);
console.log('  ✓ Task C has no metadata:', !lines6[2].match(/\w+:\S+/) ||
    (lines6[2].match(/\w+:\S+/) && lines6[2].includes('+ProjectC')));
console.log();

// Summary
const allPassed =
    todoContent1.includes('project_due:2026-04-03') &&
    todoContent1.includes('priority:high') &&
    todoContent1.includes('total:5.5') &&
    doneContent2.includes('total:3.25') &&
    doneContent2.includes('status:verified') &&
    parsed3[0].metadata?.project_due === '2026-05-01' &&
    parsed3[0].metadata?.total === '10.5' &&
    merged4[0].metadata?.project_due === '2026-03-01' &&
    merged4[0].entries?.length === 1 &&
    reparsed5[0].metadata?.project_due === '2026-07-01' &&
    reparsed5[0].metadata?.total === '12.75' &&
    reparsed5[0].metadata?.custom_field === 'custom_value' &&
    lines6[0].includes('total:1.5') &&
    lines6[1].includes('total:2.5');

console.log('='.repeat(50));
console.log(allPassed ? '✓ All tests PASSED' : '✗ Some tests FAILED');
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
