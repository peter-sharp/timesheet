// Filling a gap: tap a hole in the ribbon or a "Xm gap" row, pick a task, get one entry covering it exactly.
// E2E (Playwright, pending): on a phone viewport the popup stays on screen beside the tapped gap.
import dayRibbon, { MIN_GAP_MS } from '../utils/dayRibbon.js';
import '../timeline/timesheet.js';

const at = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(2026, 10, 5); d.setHours(h, m, 0, 0); return d; };

TestRunner.test('dayRibbon: reports gaps between entries with proportional placement', async () => {
    const { gaps } = dayRibbon([
        { id: 1, task: 'A', start: at('09:00'), end: at('10:00') },
        { id: 2, task: 'B', start: at('10:45'), end: at('11:30') }
    ]);
    TestRunner.assertEquals(gaps.length, 1, 'One gap between the two entries');
    TestRunner.assertEquals(gaps[0].beforeId, 1, 'Gap knows the entry before it');
    TestRunner.assertEquals(gaps[0].afterId, 2, 'Gap knows the entry after it');
    TestRunner.assertEquals(gaps[0].start.getHours(), 10, 'Gap starts when the previous entry ends');
    TestRunner.assertEquals(gaps[0].end.getMinutes(), 45, 'Gap ends when the next entry starts');
    // Ribbon spans 09:00–12:00 = 180 minutes; gap is 60 minutes in, 45 long
    TestRunner.assertEquals(gaps[0].left.toFixed(3), (100 / 3).toFixed(3), 'Gap starts a third of the way along');
    TestRunner.assertEquals(gaps[0].width, 25, '45 of 180 minutes is a quarter of the ribbon');
});

TestRunner.test('dayRibbon: ignores trivial gaps, overlaps and contained entries', async () => {
    const tiny = dayRibbon([
        { id: 1, task: 'A', start: at('09:00'), end: at('10:00') },
        { id: 2, task: 'B', start: at('10:02'), end: at('11:00') }
    ]);
    TestRunner.assertEquals(tiny.gaps.length, 0, 'A 2 minute gap is noise, not a gap');
    TestRunner.assertEquals(MIN_GAP_MS, 180000, 'Threshold is 3 minutes');

    const overlapping = dayRibbon([
        { id: 1, task: 'A', start: at('09:00'), end: at('11:00') },
        { id: 2, task: 'B', start: at('10:00'), end: at('10:30') },
        { id: 3, task: 'C', start: at('11:00'), end: at('11:30') }
    ]);
    TestRunner.assertEquals(overlapping.gaps.length, 0, 'An entry contained in another leaves no gap behind it');
});

TestRunner.test('gap fill: tapping a gap and picking a task creates one entry covering it', async () => {
    const appContext = document.querySelector('app-context');
    appContext.insertAdjacentHTML('beforeend', '<time-sheet data-test-gap-fill></time-sheet>');
    const sheet = appContext.querySelector('[data-test-gap-fill]');
    await new Promise(r => setTimeout(r, 20));

    appContext.tasks.value = [
        { exid: 'GL-405', description: 'Spec XPath rules' },
        { exid: 'GL-412', description: 'Client call' }
    ];
    appContext.allTasks.value = [{ exid: 'GL-100', description: 'Older task', mostRecentEntry: at('08:00') }];
    appContext.entries.value = [
        { id: 1, task: 'GL-405', annotation: '', start: at('09:00'), end: at('10:00') },
        { id: 2, task: 'GL-412', annotation: '', start: at('10:45'), end: at('11:30'), gap: 0.75 }
    ];
    await new Promise(r => setTimeout(r, 50));

    try {
        const ribbonGap = sheet.querySelector('.day-ribbon__gap[data-gap-start]');
        TestRunner.assert(!!ribbonGap, 'Ribbon renders a button in the gap');
        const listGap = sheet.querySelector('button.gap-text[data-gap-start]');
        TestRunner.assert(!!listGap, 'Gap row in the list is a button');
        TestRunner.assertEquals(listGap.textContent.trim(), '45m gap', 'Gap row still reads compactly');
        TestRunner.assertEquals(listGap.dataset.gapStart, at('10:00').toISOString(), 'Gap row carries the real bounds');

        ribbonGap.click();
        await new Promise(r => setTimeout(r, 20));
        const menu = sheet.querySelector('gap-menu .gap-menu');
        TestRunner.assert(!menu.hidden, 'Tapping the gap opens the menu');
        const options = [...menu.querySelectorAll('[data-exid]')];
        TestRunner.assertEquals(options[0].dataset.exid, 'GL-405', "Today's longest task is offered first");
        TestRunner.assert(options.some(o => o.dataset.exid === 'GL-100'), 'Recent tasks are offered too');

        menu.querySelector('[data-exid="GL-412"]').click();
        await new Promise(r => setTimeout(r, 100));

        const entries = appContext.entries.value;
        TestRunner.assertEquals(entries.length, 3, 'A new entry was created');
        const filled = entries.find(e => e.id !== 1 && e.id !== 2);
        TestRunner.assertEquals(filled.task, 'GL-412', 'Uses the chosen task');
        TestRunner.assertEquals(new Date(filled.start).getTime(), at('10:00').getTime(), 'Starts where the previous entry ended');
        TestRunner.assertEquals(new Date(filled.end).getTime(), at('10:45').getTime(), 'Ends where the next entry starts');
        TestRunner.assert(menu.hidden, 'Menu closes after choosing');
        TestRunner.assertEquals(sheet.querySelectorAll('button.gap-text[data-gap-start]').length, 0, 'The gap is gone from the list');
        TestRunner.assertEquals(sheet.querySelectorAll('.day-ribbon__gap').length, 0, 'The gap is gone from the ribbon');
    } finally {
        sheet.remove();
        appContext.entries.value = [];
        appContext.tasks.value = [];
        appContext.allTasks.value = [];
    }
});

TestRunner.test('gap fill: the list gap row opens the same menu', async () => {
    const appContext = document.querySelector('app-context');
    appContext.insertAdjacentHTML('beforeend', '<time-sheet data-test-gap-list></time-sheet>');
    const sheet = appContext.querySelector('[data-test-gap-list]');
    await new Promise(r => setTimeout(r, 20));

    appContext.tasks.value = [{ exid: 'GL-405', description: 'Spec XPath rules' }];
    appContext.entries.value = [
        { id: 11, task: 'GL-405', annotation: '', start: at('13:00'), end: at('14:00') },
        { id: 12, task: 'GL-405', annotation: '', start: at('15:00'), end: at('15:30'), gap: 1 }
    ];
    await new Promise(r => setTimeout(r, 50));

    try {
        sheet.querySelector('button.gap-text[data-gap-start]').click();
        await new Promise(r => setTimeout(r, 20));
        const menu = sheet.querySelector('gap-menu .gap-menu');
        TestRunner.assert(!menu.hidden, 'Tapping the gap row opens the menu');
        TestRunner.assertEquals(menu.querySelector('[data-header]').textContent, '14:00–15:00 · 1h', 'Header names the gap');

        menu.querySelector('[data-exid="GL-405"]').click();
        await new Promise(r => setTimeout(r, 100));
        const filled = appContext.entries.value.find(e => e.id !== 11 && e.id !== 12);
        TestRunner.assertEquals(new Date(filled.start).getTime(), at('14:00').getTime(), 'Fills from the list row too');
        TestRunner.assertEquals(new Date(filled.end).getTime(), at('15:00').getTime(), 'Covers the whole gap');
    } finally {
        sheet.remove();
        appContext.entries.value = [];
        appContext.tasks.value = [];
    }
});
