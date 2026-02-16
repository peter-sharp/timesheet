// Test for fixing duplicates that exist in files (e.g., from before the fix)
import { lineToTask, taskToLine } from '../todoTxtFormat.js';

console.log('Testing fix for duplicates in existing files...\n');

// Test 1: Parse line with duplicate due and estimate (from old file format)
const task1 = lineToTask('#638360 UAT PA renewal @install +project due:2026-02-16 estimate:1.0 due:2026-02-16 estimate:1.0');
console.log('Test 1 - Parse line with duplicate due/estimate:');
console.log('  Input: "#638360 UAT PA renewal @install +project due:2026-02-16 estimate:1.0 due:2026-02-16 estimate:1.0"');
console.log('  Parsed description:', task1.description);
console.log('  Parsed due:', task1.due);
console.log('  Parsed estimate:', task1.estimate);
console.log('  Parsed context:', task1.context);
console.log('  ✓ Description is clean:', task1.description === 'UAT PA renewal');
console.log('  ✓ due extracted once:', task1.due === '2026-02-16');
console.log('  ✓ estimate extracted once:', task1.estimate === '1.0');
console.log('  ✓ context extracted:', task1.context === 'install');
console.log();

// Test 2: Serializing cleaned task should not create duplicates
const serialized1 = taskToLine(task1);
console.log('Test 2 - Serialize cleaned task:');
console.log('  Serialized:', serialized1);
console.log('  ✓ due appears once:', (serialized1.match(/due:2026-02-16/g) || []).length === 1);
console.log('  ✓ estimate appears once:', (serialized1.match(/estimate:1.0/g) || []).length === 1);
console.log('  ✓ @install appears once:', (serialized1.match(/@install/g) || []).length === 1);
console.log();

// Test 3: Triple duplicates (worst case)
const task3 = lineToTask('#12345 Task @context +project due:2026-01-01 due:2026-01-01 due:2026-01-01 estimate:2h estimate:2h');
console.log('Test 3 - Triple duplicate due:');
console.log('  Input: "#12345 Task @context +project due:2026-01-01 due:2026-01-01 due:2026-01-01 estimate:2h estimate:2h"');
console.log('  Parsed description:', task3.description);
console.log('  Parsed due:', task3.due);
console.log('  Parsed estimate:', task3.estimate);
console.log('  ✓ Description is clean:', task3.description === 'Task');
console.log('  ✓ due extracted:', task3.due === '2026-01-01');
console.log('  ✓ estimate extracted:', task3.estimate === '2h');
console.log();

// Test 4: Duplicate with custom metadata
const task4 = lineToTask('#99999 Task +project due:2026-03-01 total:5.5 due:2026-03-01 total:5.5');
console.log('Test 4 - Duplicate due and custom metadata:');
console.log('  Input: "#99999 Task +project due:2026-03-01 total:5.5 due:2026-03-01 total:5.5"');
console.log('  Parsed description:', task4.description);
console.log('  Parsed due:', task4.due);
console.log('  Parsed metadata:', task4.metadata);
console.log('  ✓ Description is clean:', task4.description === 'Task');
console.log('  ✓ due extracted:', task4.due === '2026-03-01');
console.log('  ✓ total in metadata (first value):', task4.metadata?.total === '5.5');
console.log();

// Test 5: Description with text between duplicates
const task5 = lineToTask('#11111 First part due:2026-02-16 middle text estimate:1.0 end text due:2026-02-16 estimate:1.0');
console.log('Test 5 - Text between duplicate metadata:');
console.log('  Input: "#11111 First part due:2026-02-16 middle text estimate:1.0 end text due:2026-02-16 estimate:1.0"');
console.log('  Parsed description:', task5.description);
console.log('  Parsed due:', task5.due);
console.log('  Parsed estimate:', task5.estimate);
console.log('  ✓ All metadata removed from description:', task5.description === 'First part middle text end text');
console.log('  ✓ due extracted:', task5.due === '2026-02-16');
console.log('  ✓ estimate extracted:', task5.estimate === '1.0');
console.log();

// Test 6: Round-trip stability after cleaning duplicates
const task6 = lineToTask('#77777 Task @work +proj due:2026-04-01 estimate:3h due:2026-04-01 estimate:3h total:10 total:10');
const trip1 = taskToLine(task6);
const trip2 = taskToLine(lineToTask(trip1));
const trip3 = taskToLine(lineToTask(trip2));

console.log('Test 6 - Round-trip stability after cleaning:');
console.log('  Original input with duplicates');
console.log('  Trip 1 (after cleaning):', trip1);
console.log('  Trip 2:', trip2);
console.log('  Trip 3:', trip3);
console.log('  ✓ All trips identical:', trip1 === trip2 && trip2 === trip3);
console.log('  ✓ No duplicates in final:',
    (trip3.match(/@work/g) || []).length === 1 &&
    (trip3.match(/due:2026-04-01/g) || []).length === 1 &&
    (trip3.match(/estimate:3h/g) || []).length === 1 &&
    (trip3.match(/total:10/g) || []).length === 1
);
console.log();

// Test 7: Real-world example from screenshot
const task7 = lineToTask('#638360 PA renewal - duplicate payment listed on receipt when previous name exists @install +AZBOM_-_67108 client:AZBOM due:2026-02-16 estimate:1.0 estimate:1.0 due:2026-02-16');
console.log('Test 7 - Real-world example:');
console.log('  Parsed description:', task7.description);
console.log('  Parsed context:', task7.context);
console.log('  Parsed project:', task7.project);
console.log('  Parsed client:', task7.client);
console.log('  Parsed due:', task7.due);
console.log('  Parsed estimate:', task7.estimate);
console.log('  ✓ Clean description (no metadata):',
    task7.description === 'PA renewal - duplicate payment listed on receipt when previous name exists' &&
    !task7.description.includes('@') &&
    !task7.description.includes('due:') &&
    !task7.description.includes('estimate:')
);
console.log('  ✓ All fields extracted correctly:',
    task7.context === 'install' &&
    task7.due === '2026-02-16' &&
    task7.estimate === '1.0'
);
console.log();

// Summary
const allPassed =
    task1.description === 'UAT PA renewal' &&
    task1.due === '2026-02-16' &&
    task1.estimate === '1.0' &&
    (serialized1.match(/due:2026-02-16/g) || []).length === 1 &&
    (serialized1.match(/estimate:1.0/g) || []).length === 1 &&
    task3.description === 'Task' &&
    task4.description === 'Task' &&
    task5.description === 'First part middle text end text' &&
    trip1 === trip2 && trip2 === trip3 &&
    task7.description === 'PA renewal - duplicate payment listed on receipt when previous name exists';

console.log('='.repeat(50));
console.log(allPassed ? '✓ All tests PASSED - Duplicates cleaned!' : '✗ Some tests FAILED');
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
