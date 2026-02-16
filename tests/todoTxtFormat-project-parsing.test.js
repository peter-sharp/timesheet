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

// Test 6: Parse due date
const task6 = lineToTask('#630034 NASBA NTC Import AT +NCBOA due:2026-01-07');
console.log('Test 6 - Due date parsing:');
console.log('  Input: "#630034 NASBA NTC Import AT +NCBOA due:2026-01-07"');
console.log('  Parsed due:', task6.due);
console.log('  Expected: "2026-01-07"');
console.log('  ✓ Pass:', task6.due === '2026-01-07');
console.log();

// Test 7: Parse estimate
const task7 = lineToTask('#12345 Task with estimate +project estimate:2h');
console.log('Test 7 - Estimate parsing:');
console.log('  Input: "#12345 Task with estimate +project estimate:2h"');
console.log('  Parsed estimate:', task7.estimate);
console.log('  Expected: "2h"');
console.log('  ✓ Pass:', task7.estimate === '2h');
console.log();

// Test 8: Parse all metadata together
const task8 = lineToTask('#630034 NASBA NTC Import AT +NCBOA-test client:clientA due:2026-01-07 estimate:3h');
console.log('Test 8 - All metadata together:');
console.log('  Input: "#630034 NASBA NTC Import AT +NCBOA-test client:clientA due:2026-01-07 estimate:3h"');
console.log('  Project:', task8.project);
console.log('  Client:', task8.client);
console.log('  Due:', task8.due);
console.log('  Estimate:', task8.estimate);
console.log('  ✓ Pass:', task8.project === 'NCBOA-test' && task8.client === 'clientA' && task8.due === '2026-01-07' && task8.estimate === '3h');
console.log();

// Test 9: Round-trip with all metadata
const serialized9 = taskToLine(task8);
console.log('Test 9 - Round-trip with all metadata:');
console.log('  Serialized:', serialized9);
console.log('  ✓ Pass:', serialized9.includes('due:2026-01-07') && serialized9.includes('estimate:3h'));
console.log();

// Test 10: Parse @context
const task10 = lineToTask('#630034 Task with context @home +project');
console.log('Test 10 - Context parsing:');
console.log('  Input: "#630034 Task with context @home +project"');
console.log('  Parsed context:', task10.context);
console.log('  Expected: "home"');
console.log('  ✓ Pass:', task10.context === 'home');
console.log();

// Test 11: Context with special characters
const task11 = lineToTask('#11111 Task @work-from-home');
console.log('Test 11 - Context with dashes:');
console.log('  Input: "#11111 Task @work-from-home"');
console.log('  Parsed context:', task11.context);
console.log('  Expected: "work-from-home"');
console.log('  ✓ Pass:', task11.context === 'work-from-home');
console.log();

// Summary
const allPassed =
  task1.project === 'NCBOA-test' &&
  task2.project === 'project_name' &&
  task3.project === 'my-project_name' &&
  task4.project === 'project.v2' &&
  serialized.includes('+NCBOA-test') &&
  task6.due === '2026-01-07' &&
  task7.estimate === '2h' &&
  task8.project === 'NCBOA-test' &&
  task8.client === 'clientA' &&
  task8.due === '2026-01-07' &&
  task8.estimate === '3h' &&
  serialized9.includes('due:2026-01-07') &&
  serialized9.includes('estimate:3h') &&
  task10.context === 'home' &&
  task11.context === 'work-from-home';

console.log('='.repeat(50));
console.log(allPassed ? '✓ All tests PASSED' : '✗ Some tests FAILED');
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);
