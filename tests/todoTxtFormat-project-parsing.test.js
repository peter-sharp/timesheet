// Test for project parsing with dashes and underscores
import { lineToTask, taskToLine } from '../todoTxtFormat.js';

console.log('Testing project parsing with special characters...\n');

// Test 1: Project with dash
const task1 = lineToTask('#630034 NASBA NTC Import AT +NCBOA-test client:clientA');
console.log('Test 1 - Project with dash:');
console.log('  Input: "#630034 NASBA NTC Import AT +NCBOA-test client:clientA"');
console.log('  Parsed project:', task1.project);
console.log('  Expected: "NCBOA-test"');
console.log('  ✓ Pass:', task1.project === 'NCBOA-test');
console.log();

// Test 2: Project with underscore
const task2 = lineToTask('#12345 Some task +project_name client:clientB');
console.log('Test 2 - Project with underscore:');
console.log('  Input: "#12345 Some task +project_name client:clientB"');
console.log('  Parsed project:', task2.project);
console.log('  Expected: "project_name"');
console.log('  ✓ Pass:', task2.project === 'project_name');
console.log();

// Test 3: Project with both dash and underscore
const task3 = lineToTask('#99999 Task +my-project_name');
console.log('Test 3 - Project with dash and underscore:');
console.log('  Input: "#99999 Task +my-project_name"');
console.log('  Parsed project:', task3.project);
console.log('  Expected: "my-project_name"');
console.log('  ✓ Pass:', task3.project === 'my-project_name');
console.log();

// Test 4: Project with period
const task4 = lineToTask('#11111 Task +project.v2');
console.log('Test 4 - Project with period:');
console.log('  Input: "#11111 Task +project.v2"');
console.log('  Parsed project:', task4.project);
console.log('  Expected: "project.v2"');
console.log('  ✓ Pass:', task4.project === 'project.v2');
console.log();

// Test 5: Round-trip test (parse and serialize)
const task5 = lineToTask('#630034 NASBA NTC Import AT +NCBOA-test client:clientA');
const serialized = taskToLine(task5);
console.log('Test 5 - Round-trip:');
console.log('  Original: "#630034 NASBA NTC Import AT +NCBOA-test client:clientA"');
console.log('  Serialized:', serialized);
console.log('  ✓ Pass:', serialized.includes('+NCBOA-test'));
console.log();

// Summary
const allPassed =
  task1.project === 'NCBOA-test' &&
  task2.project === 'project_name' &&
  task3.project === 'my-project_name' &&
  task4.project === 'project.v2' &&
  serialized.includes('+NCBOA-test');

console.log('='.repeat(50));
console.log(allPassed ? '✓ All tests PASSED' : '✗ Some tests FAILED');
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
