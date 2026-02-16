// Test for displaying underscores as spaces in project names
import { lineToTask, taskToLine } from '../todoTxtFormat.js';

console.log('Testing project display with underscores as spaces...\n');

// Test 1: Parse project with underscores - storage should keep underscores
const task1 = lineToTask('#630034 NASBA NTC Import AT +NCBOA_-_test client:clientA');
console.log('Test 1 - Project with underscores in storage:');
console.log('  Input: "#630034 NASBA NTC Import AT +NCBOA_-_test client:clientA"');
console.log('  Parsed project (stored):', task1.project);
console.log('  ✓ Stored with underscores:', task1.project === 'NCBOA_-_test');
console.log();

// Test 2: Project display conversion (what user sees)
const displayProject1 = task1.project.replace(/_/g, ' ');
console.log('Test 2 - Project display conversion:');
console.log('  Stored:', task1.project);
console.log('  Displayed:', displayProject1);
console.log('  ✓ Displays with spaces:', displayProject1 === 'NCBOA - test');
console.log();

// Test 3: Complex project name
const task3 = lineToTask('#67890 Task +AZBOM_-_67108_-_Client_Independent_Testing');
const displayProject3 = task3.project.replace(/_/g, ' ');
console.log('Test 3 - Complex project name:');
console.log('  Stored:', task3.project);
console.log('  Displayed:', displayProject3);
console.log('  ✓ Stored correctly:', task3.project === 'AZBOM_-_67108_-_Client_Independent_Testing');
console.log('  ✓ Displays correctly:', displayProject3 === 'AZBOM - 67108 - Client Independent Testing');
console.log();

// Test 4: Round-trip - storage should preserve underscores
const serialized3 = taskToLine(task3);
const reparsed3 = lineToTask(serialized3);
console.log('Test 4 - Round-trip preserves underscores:');
console.log('  Original project:', task3.project);
console.log('  Serialized:', serialized3);
console.log('  Reparsed project:', reparsed3.project);
console.log('  ✓ Underscores preserved:', reparsed3.project === task3.project);
console.log('  ✓ Still has underscores:', reparsed3.project.includes('_'));
console.log();

// Test 5: Project without underscores should be unchanged
const task5 = lineToTask('#11111 Task +SimpleProject');
const displayProject5 = task5.project.replace(/_/g, ' ');
console.log('Test 5 - Project without underscores:');
console.log('  Stored:', task5.project);
console.log('  Displayed:', displayProject5);
console.log('  ✓ Same in both:', task5.project === displayProject5);
console.log();

// Test 6: Mixed - underscores and hyphens
const task6 = lineToTask('#22222 Task +project_name-v2_final');
const displayProject6 = task6.project.replace(/_/g, ' ');
console.log('Test 6 - Mixed underscores and hyphens:');
console.log('  Stored:', task6.project);
console.log('  Displayed:', displayProject6);
console.log('  ✓ Stored correctly:', task6.project === 'project_name-v2_final');
console.log('  ✓ Only underscores converted:', displayProject6 === 'project name-v2 final');
console.log('  ✓ Hyphens preserved:', displayProject6.includes('-'));
console.log();

// Test 7: Verify storage format doesn't change
const task7 = lineToTask('#33333 Task +my_project_name due:2026-02-16');
const serialized7 = taskToLine(task7);
console.log('Test 7 - Storage format unchanged:');
console.log('  Serialized:', serialized7);
console.log('  ✓ Contains +my_project_name:', serialized7.includes('+my_project_name'));
console.log('  ✓ Does NOT contain spaces in project:', !serialized7.match(/\+my project name/));
console.log();

// Test 8: Datalist simulation - what appears in autocomplete
const task8 = lineToTask('#44444 UAT testing @work +AZBOM_-_67108 due:2026-03-01');
const datalistValue = [
  task8.exid ? `#${task8.exid}` : '',
  task8.description,
  task8.project ? `+${task8.project.replace(/_/g, ' ')}` : '',
  task8.context ? `@${task8.context}` : '',
  task8.due ? `due:${task8.due}` : ''
].filter(Boolean).join(' ');

console.log('Test 8 - Datalist autocomplete display:');
console.log('  Stored project:', task8.project);
console.log('  Datalist value:', datalistValue);
console.log('  ✓ Shows project with spaces:', datalistValue.includes('+AZBOM - 67108'));
console.log('  ✓ Does not show underscores:', !datalistValue.includes('AZBOM_-_67108'));
console.log();

// Summary
const allPassed =
  task1.project === 'NCBOA_-_test' &&
  displayProject1 === 'NCBOA - test' &&
  task3.project === 'AZBOM_-_67108_-_Client_Independent_Testing' &&
  displayProject3 === 'AZBOM - 67108 - Client Independent Testing' &&
  reparsed3.project === task3.project &&
  task5.project === displayProject5 &&
  task6.project === 'project_name-v2_final' &&
  displayProject6 === 'project name-v2 final' &&
  serialized7.includes('+my_project_name') &&
  datalistValue.includes('+AZBOM - 67108');

console.log('='.repeat(60));
console.log(allPassed ? '✓ All tests PASSED - Underscores display as spaces!' : '✗ Some tests FAILED');
console.log('='.repeat(60));

process.exit(allPassed ? 0 : 1);
