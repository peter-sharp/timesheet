// Test for verifying no duplicate context and metadata in descriptions
import { lineToTask, taskToLine } from '../todoTxtFormat.js';

console.log('Testing for duplicate context and metadata in descriptions...\n');

// Test 1: Context should not appear in description
const task1 = lineToTask('#12345 Task description @install +project due:2026-02-16 estimate:1.0');
console.log('Test 1 - Context not in description:');
console.log('  Input: "#12345 Task description @install +project due:2026-02-16 estimate:1.0"');
console.log('  Parsed context:', task1.context);
console.log('  Parsed description:', task1.description);
console.log('  ✓ Context extracted:', task1.context === 'install');
console.log('  ✓ Context NOT in description:', !task1.description.includes('@install'));
console.log();

// Test 2: due and estimate should not appear in description
const task2 = lineToTask('#67890 Another task +project due:2026-02-16 estimate:1.0');
console.log('Test 2 - due/estimate not in description:');
console.log('  Input: "#67890 Another task +project due:2026-02-16 estimate:1.0"');
console.log('  Parsed due:', task2.due);
console.log('  Parsed estimate:', task2.estimate);
console.log('  Parsed description:', task2.description);
console.log('  ✓ due extracted:', task2.due === '2026-02-16');
console.log('  ✓ estimate extracted:', task2.estimate === '1.0');
console.log('  ✓ due NOT in description:', !task2.description.includes('due:'));
console.log('  ✓ estimate NOT in description:', !task2.description.includes('estimate:'));
console.log();

// Test 3: Custom metadata should not appear in description
const task3 = lineToTask('#99999 Task with metadata +project total:5.5 priority:high');
console.log('Test 3 - Custom metadata not in description:');
console.log('  Input: "#99999 Task with metadata +project total:5.5 priority:high"');
console.log('  Parsed metadata:', task3.metadata);
console.log('  Parsed description:', task3.description);
console.log('  ✓ total in metadata:', task3.metadata?.total === '5.5');
console.log('  ✓ priority in metadata:', task3.metadata?.priority === 'high');
console.log('  ✓ total NOT in description:', !task3.description.includes('total:'));
console.log('  ✓ priority NOT in description:', !task3.description.includes('priority:'));
console.log();

// Test 4: Complex task with all patterns - none should duplicate in description
const task4 = lineToTask('#11111 PA renewal duplicate payment @install +project due:2026-02-16 estimate:1.0 total:2.5 status:active');
console.log('Test 4 - Complex task with all patterns:');
console.log('  Input: "#11111 PA renewal duplicate payment @install +project due:2026-02-16 estimate:1.0 total:2.5 status:active"');
console.log('  Parsed description:', task4.description);
console.log('  Parsed context:', task4.context);
console.log('  Parsed due:', task4.due);
console.log('  Parsed estimate:', task4.estimate);
console.log('  Parsed metadata:', task4.metadata);
console.log('  ✓ Clean description:', task4.description === 'PA renewal duplicate payment');
console.log('  ✓ Context extracted:', task4.context === 'install');
console.log('  ✓ due extracted:', task4.due === '2026-02-16');
console.log('  ✓ estimate extracted:', task4.estimate === '1.0');
console.log('  ✓ Metadata extracted:', task4.metadata?.total === '2.5' && task4.metadata?.status === 'active');
console.log();

// Test 5: Round-trip should not create duplicates
const task5 = lineToTask('#55555 UAT PA renewal @install +project due:2026-02-16 estimate:1.0');
const serialized5 = taskToLine(task5);
const reparsed5 = lineToTask(serialized5);

console.log('Test 5 - Round-trip without duplicates:');
console.log('  Original input: "#55555 UAT PA renewal @install +project due:2026-02-16 estimate:1.0"');
console.log('  First parse description:', task5.description);
console.log('  Serialized:', serialized5);
console.log('  Reparsed description:', reparsed5.description);
console.log('  ✓ No duplicate @install:', (serialized5.match(/@install/g) || []).length === 1);
console.log('  ✓ No duplicate due:', (serialized5.match(/due:2026-02-16/g) || []).length === 1);
console.log('  ✓ No duplicate estimate:', (serialized5.match(/estimate:1.0/g) || []).length === 1);
console.log('  ✓ Description matches:', task5.description === reparsed5.description);
console.log();

// Test 6: Verify serialization puts context in correct position (not in description)
const task6 = lineToTask('#66666 Task @context +project due:2026-03-01');
const serialized6 = taskToLine(task6);
console.log('Test 6 - Serialization structure:');
console.log('  Serialized:', serialized6);
console.log('  ✓ Has @context once:', serialized6.includes('@context') && (serialized6.match(/@context/g) || []).length === 1);
console.log('  ✓ Has due: once:', serialized6.includes('due:2026-03-01') && (serialized6.match(/due:2026-03-01/g) || []).length === 1);
console.log();

// Test 7: Multiple round-trips should be stable
const task7 = lineToTask('#77777 Multi-trip test @work +project due:2026-04-01 estimate:3h total:10');
const trip1 = taskToLine(task7);
const trip2 = taskToLine(lineToTask(trip1));
const trip3 = taskToLine(lineToTask(trip2));

console.log('Test 7 - Multiple round-trips stability:');
console.log('  Trip 1:', trip1);
console.log('  Trip 2:', trip2);
console.log('  Trip 3:', trip3);
console.log('  ✓ All trips identical:', trip1 === trip2 && trip2 === trip3);
console.log('  ✓ No duplicates in trip 3:',
    (trip3.match(/@work/g) || []).length === 1 &&
    (trip3.match(/due:2026-04-01/g) || []).length === 1 &&
    (trip3.match(/estimate:3h/g) || []).length === 1 &&
    (trip3.match(/total:10/g) || []).length === 1
);
console.log();

// Summary
const allPassed =
    task1.context === 'install' &&
    !task1.description.includes('@install') &&
    task2.due === '2026-02-16' &&
    task2.estimate === '1.0' &&
    !task2.description.includes('due:') &&
    !task2.description.includes('estimate:') &&
    task3.metadata?.total === '5.5' &&
    !task3.description.includes('total:') &&
    task4.description === 'PA renewal duplicate payment' &&
    (serialized5.match(/@install/g) || []).length === 1 &&
    (serialized5.match(/due:2026-02-16/g) || []).length === 1 &&
    (serialized5.match(/estimate:1.0/g) || []).length === 1 &&
    trip1 === trip2 && trip2 === trip3;

console.log('='.repeat(50));
console.log(allPassed ? '✓ All tests PASSED - No duplicates!' : '✗ Some tests FAILED');
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
