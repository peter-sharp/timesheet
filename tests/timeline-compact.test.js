// Timeline compactness: <details> rows + sticky day ribbon
// E2E (Playwright, pending): on a phone viewport, ribbon stays pinned while scrolling the timeline;
// tapping a ribbon segment scrolls to and opens that entry; editing an opened entry keeps it open after save.
import dayRibbon, { exidColor, formatShortDuration } from '../utils/dayRibbon.js';
import '../timeline/timesheet.js';

const at = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(2026, 10, 5); d.setHours(h, m, 0, 0); return d; };

TestRunner.test('dayRibbon: spans whole hours and lays entries out proportionally', async () => {
    const { start, end, segments, ticks } = dayRibbon([
        { id: 2, task: 'B', start: at('10:00'), end: at('11:30') },
        { id: 1, task: 'A', start: at('09:15'), end: at('09:45') },
        { id: 3, task: 'C', start: at('12:00'), end: null }
    ]);
    TestRunner.assertEquals(start.getHours(), 9, 'Starts at the hour before the first entry');
    TestRunner.assertEquals(end.getHours(), 12, 'Ends at the hour after the last finished entry');
    TestRunner.assertEquals(segments.length, 2, 'Unfinished entries are skipped');
    TestRunner.assertEquals(segments[0].id, 1, 'Segments are chronological');
    TestRunner.assertEquals(segments[0].left.toFixed(3), (25 / 3).toFixed(3), '09:15 is 15 of 180 minutes in');
    TestRunner.assertEquals(segments[1].width, 50, '90 of 180 minutes is half the ribbon');
    TestRunner.assertEquals(ticks.map((t) => t.hour).join(','), '9,10,11,12', 'One tick per hour inclusive');
});

TestRunner.test('dayRibbon: empty input gives an empty ribbon; helpers format', async () => {
    TestRunner.assertEquals(dayRibbon([]).segments.length, 0, 'No segments');
    TestRunner.assertEquals(formatShortDuration(7 * 60000), '7m', 'Minutes only');
    TestRunner.assertEquals(formatShortDuration(120 * 60000), '2h', 'Whole hours');
    TestRunner.assertEquals(formatShortDuration(135 * 60000), '2h 15m', 'Hours and minutes');
    TestRunner.assertEquals(exidColor('GL-1'), exidColor('GL-1'), 'Colour is stable per exid');
});

TestRunner.test('timeline: entries render as collapsed one-line details with a ribbon that opens them', async () => {
    const appContext = document.querySelector('app-context');
    // Parsed (not createElement) since the component appends children in its constructor
    appContext.insertAdjacentHTML('beforeend', '<time-sheet data-test-timeline></time-sheet>');
    const sheet = appContext.querySelector('[data-test-timeline]');
    await new Promise(r => setTimeout(r, 20));

    appContext.tasks.value = [{ exid: 'GL-405', description: 'Spec XPath rules' }];
    appContext.entries.value = [
        { id: 1, task: 'GL-405', annotation: '', start: at('09:25'), end: at('11:40') },
        { id: 2, task: 'GL-412', annotation: 'call', start: at('12:30'), end: at('12:37'), gap: 50 / 60 }
    ];
    await new Promise(r => setTimeout(r, 50));

    try {
        const rows = [...sheet.querySelectorAll('#time_entries details.time-entry')];
        TestRunner.assertEquals(rows.length, 2, 'One details per entry');
        TestRunner.assertEquals(rows[0].dataset.id, '2', 'Newest first');
        TestRunner.assert(rows.every((row) => !row.open), 'Collapsed by default');

        const summary = (row) => [...row.querySelectorAll('summary > span')].map((s) => s.textContent).filter(Boolean).join(' ');
        TestRunner.assertEquals(summary(rows[1]), '09:25–11:40 2h 15m GL-405 Spec XPath rules', 'Summary: range duration exid description');
        TestRunner.assertEquals(summary(rows[0]), '12:30–12:37 7m GL-412 call', 'Unknown task falls back to exid + annotation');
        TestRunner.assertEquals(sheet.querySelector('.gap-text').textContent.trim(), '50m gap', 'Gap shown compactly');
        TestRunner.assertEquals(rows[1].querySelector('[name="time_start"]').value, '09:25', 'Edit form is filled');

        const ribbon = sheet.querySelector('[data-ribbon]');
        TestRunner.assert(!ribbon.hidden, 'Ribbon shown when there are entries');
        const segments = ribbon.querySelectorAll('button[data-segment]');
        TestRunner.assertEquals(segments.length, 2, 'One segment per finished entry');

        ribbon.querySelector('[data-segment="1"]').click();
        const opened = sheet.querySelector('details[data-id="1"]');
        TestRunner.assert(opened.open, 'Clicking a segment opens its entry');
        TestRunner.assert(ribbon.querySelector('[data-segment="1"]').classList.contains('is-open'), 'Segment marks open entry');

        // Re-render (any signal change) keeps the entry open
        appContext.entries.value = [...appContext.entries.value];
        await new Promise(r => setTimeout(r, 50));
        TestRunner.assert(sheet.querySelector('details[data-id="1"]').open, 'Open state survives re-render');
    } finally {
        sheet.remove();
        appContext.entries.value = [];
        appContext.tasks.value = [];
    }
});
