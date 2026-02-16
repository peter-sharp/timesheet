// Test for arbitrary key:value metadata parsing
import { lineToTask, taskToLine } from '../todoTxtFormat.js';

console.log('Testing arbitrary metadata parsing...\n');

// Test 1: Single metadata field
const task1 = lineToTask('#12345 Task description +project project_due:2026-04-03');
console.log('Test 1 - Single metadata field:');
console.log('  Input: "#12345 Task description +project project_due:2026-04-03"');
console.log('  Parsed metadata:', task1.metadata);
console.log('  Expected: { project_due: "2026-04-03" }');
console.log('  ✓ Pass:', task1.metadata?.project_due === '2026-04-03');
console.log();

// Test 2: Multiple metadata fields
const task2 = lineToTask('#67890 Another task +AZBOM_-_67108_-_Client_Independent_Testing project_due:2026-04-03 priority:high status:active');
console.log('Test 2 - Multiple metadata fields:');
console.log('  Input: "#67890 Another task +AZBOM_-_67108_-_Client_Independent_Testing project_due:2026-04-03 priority:high status:active"');
console.log('  Parsed project:', task2.project);
console.log('  Parsed metadata:', task2.metadata);
console.log('  Expected project: "AZBOM_-_67108_-_Client_Independent_Testing"');
console.log('  Expected metadata: { project_due: "2026-04-03", priority: "high", status: "active" }');
console.log('  ✓ Pass:',
    task2.project === 'AZBOM_-_67108_-_Client_Independent_Testing' &&
    task2.metadata?.project_due === '2026-04-03' &&
    task2.metadata?.priority === 'high' &&
    task2.metadata?.status === 'active'
);
console.log();

// Test 3: Metadata with known fields (should not capture known fields in metadata)
const task3 = lineToTask('#99999 Task +project client:clientA custom_field:value123');
console.log('Test 3 - Metadata with known fields:');
console.log('  Input: "#99999 Task +project client:clientA custom_field:value123"');
console.log('  Parsed client:', task3.client);
console.log('  Parsed metadata:', task3.metadata);
console.log('  Expected client: "clientA"');
console.log('  Expected metadata: { custom_field: "value123" }');
console.log('  ✓ Pass:',
    task3.client === 'clientA' &&
    task3.metadata?.custom_field === 'value123' &&
    !task3.metadata?.client
);
console.log();

// Test 4: Round-trip test (parse and serialize with metadata)
const task4 = lineToTask('#12345 Task +project project_due:2026-04-03 priority:high');
const serialized4 = taskToLine(task4);
console.log('Test 4 - Round-trip with metadata:');
console.log('  Original: "#12345 Task +project project_due:2026-04-03 priority:high"');
console.log('  Serialized:', serialized4);
console.log('  ✓ Pass:', serialized4.includes('project_due:2026-04-03') && serialized4.includes('priority:high'));
console.log();

// Test 5: Metadata with underscores and numbers
const task5 = lineToTask('#11111 Task test_key_123:value_456 build_number:2024.1.1');
console.log('Test 5 - Metadata with underscores and numbers:');
console.log('  Input: "#11111 Task test_key_123:value_456 build_number:2024.1.1"');
console.log('  Parsed metadata:', task5.metadata);
console.log('  Expected: { test_key_123: "value_456", build_number: "2024.1.1" }');
console.log('  ✓ Pass:',
    task5.metadata?.test_key_123 === 'value_456' &&
    task5.metadata?.build_number === '2024.1.1'
);
console.log();

// Test 6: Task with no custom metadata
const task6 = lineToTask('#22222 Simple task +project client:clientB');
console.log('Test 6 - Task with no custom metadata:');
console.log('  Input: "#22222 Simple task +project client:clientB"');
console.log('  Parsed metadata:', task6.metadata);
console.log('  Expected: undefined or {}');
console.log('  ✓ Pass:', !task6.metadata || Object.keys(task6.metadata).length === 0);
console.log();

// Test 7: Metadata with URLs and complex values
const task7 = lineToTask('#33333 Task repo_url:https://github.com/user/repo');
console.log('Test 7 - Metadata with complex values:');
console.log('  Input: "#33333 Task repo_url:https://github.com/user/repo"');
console.log('  Parsed metadata:', task7.metadata);
console.log('  Expected: { repo_url: "https://github.com/user/repo" }');
console.log('  ✓ Pass:', task7.metadata?.repo_url === 'https://github.com/user/repo');
console.log();

// Summary
const allPassed =
    task1.metadata?.project_due === '2026-04-03' &&
    task2.project === 'AZBOM_-_67108_-_Client_Independent_Testing' &&
    task2.metadata?.project_due === '2026-04-03' &&
    task2.metadata?.priority === 'high' &&
    task2.metadata?.status === 'active' &&
    task3.client === 'clientA' &&
    task3.metadata?.custom_field === 'value123' &&
    !task3.metadata?.client &&
    serialized4.includes('project_due:2026-04-03') &&
    serialized4.includes('priority:high') &&
    task5.metadata?.test_key_123 === 'value_456' &&
    task5.metadata?.build_number === '2024.1.1' &&
    (!task6.metadata || Object.keys(task6.metadata).length === 0) &&
    task7.metadata?.repo_url === 'https://github.com/user/repo';

console.log('='.repeat(50));
console.log(allPassed ? '✓ All tests PASSED' : '✗ Some tests FAILED');
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
