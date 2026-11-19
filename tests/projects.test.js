// Projects view: derivation rules (utils/projects.js) and the projects timeline / detail pages
import TimesheetDB from '../timesheetDb.js';
import { buildProjects, groupProjectsByMonth, findProject, projectName } from '../utils/projects.js';
import '../projects/projects-page.js';
import '../projects/project-detail.js';

const appContext = document.querySelector('app-context');
const wait = (ms = 150) => new Promise(r => setTimeout(r, ms));

// YYYY-MM-DD `months` from now (day 15 keeps it mid-month)
function dueIn(months) {
    const d = new Date();
    d.setDate(15);
    d.setMonth(d.getMonth() + months);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
}

async function seed({ tasks = [], entries = [] }) {
    const db = await TimesheetDB();
    for (const task of await db.getAllTasks()) await db.permanentlyDeleteTask(task.exid);
    for await (const task of db.getDeletedTasks()) await db.permanentlyDeleteTask(task.exid);
    for (const entry of await db.getAllEntries()) await db.permanentlyDeleteEntry(entry.id);
    for (const task of tasks) await db.addTask(task);
    for (const entry of entries) await db.addEntry(entry);
}

function hoursEntry(id, task, hours, daysAgo = 1) {
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    start.setHours(9, 0, 0, 0);
    return { id, task, start, end: new Date(start.getTime() + hours * 3600000) };
}

// ── Derivation ───────────────────────────────────────────────────────────────

TestRunner.test('projects: name strips dashes and underscores', async () => {
    TestRunner.assertEquals(projectName('web_app-v2'), 'web app v2');
    TestRunner.assertEquals(projectName('NCBOA_-_test'), 'NCBOA test');
});

TestRunner.test('projects: progress, estimate, hours and due derive from tasks', async () => {
    const [project] = buildProjects([
        { exid: 'a', project: 'site', complete: true, estimate: '2', due: '2026-01-10' },
        { exid: 'b', project: 'site', estimate: '3', due: '2026-03-01' },
        { exid: 'c', project: 'site', status: 'complete' },
        { exid: 'd', project: 'site' }
    ], { a: 1.5, b: 0.5 });
    TestRunner.assertEquals(project.name, 'site');
    TestRunner.assertEquals(project.count, 4);
    TestRunner.assertEquals(project.done, 2);
    TestRunner.assertEquals(project.progress, 0.5);
    TestRunner.assertEquals(Math.round(project.estimate * 10) / 10, 6.6, 'unset estimates use default 0.8');
    TestRunner.assertEquals(project.hours, 2);
    TestRunner.assertEquals(project.due, '2026-03-01', 'furthest future due date');
    TestRunner.assertEquals(project.task, null, 'no dedicated task');
});

TestRunner.test('projects: dedicated task overrides due and nests under its parent', async () => {
    const projects = buildProjects([
        { exid: 'app', project: 'client', due: '2026-12-31' },
        { exid: 'x', project: 'app', due: '2026-02-01', complete: true },
        { exid: 'y', project: 'app' },
        { exid: 'z', project: 'client', due: '2026-05-01' }
    ], { app: 1, x: 2, z: 4 }, { x: new Date(2026, 1, 3), z: new Date(2026, 4, 2) });
    TestRunner.assertEquals(projects.length, 1, 'only top-level project returned');
    const [client] = projects;
    TestRunner.assertEquals(client.tag, 'client');
    TestRunner.assertEquals(client.children.length, 1);
    const app = client.children[0];
    TestRunner.assertEquals(app.task.exid, 'app');
    TestRunner.assertEquals(app.parent, 'client');
    TestRunner.assertEquals(app.due, '2026-12-31', 'dedicated task due wins');
    TestRunner.assertEquals(app.count, 2);
    TestRunner.assertEquals(app.hours, 3, 'includes dedicated task hours');
    TestRunner.assertEquals(client.tasks.length, 1, 'child dedicated task not a member of parent');
    TestRunner.assertEquals(client.count, 3, 'rolled up from child');
    TestRunner.assertEquals(client.done, 1);
    TestRunner.assertEquals(client.hours, 7);
    TestRunner.assertEquals(client.due, '2026-12-31', 'furthest due includes children');
    TestRunner.assertEquals(app.lastEntry.getTime(), new Date(2026, 1, 3).getTime(), 'last entry of child');
    TestRunner.assertEquals(client.lastEntry.getTime(), new Date(2026, 4, 2).getTime(), 'last entry incl. children');
    TestRunner.assertEquals(buildProjects([{ exid: 'q', project: 'quiet' }])[0].lastEntry, null, 'no entries');
    TestRunner.assertEquals(findProject(projects, 'app'), app, 'findProject searches nested');
});

TestRunner.test('projects: parent cycles do not loop or drop projects', async () => {
    const projects = buildProjects([
        { exid: 'p1', project: 'p2' },
        { exid: 'p2', project: 'p1' },
        { exid: 't', project: 'p1' }
    ]);
    TestRunner.assertEquals(projects.length, 1);
    TestRunner.assert(findProject(projects, 'p1') && findProject(projects, 'p2'), 'both projects reachable');
});

TestRunner.test('projects: grouped by month within ±3 months, rest paged', async () => {
    const now = new Date(2026, 5, 15);
    const projects = [
        { tag: 'none', due: '', lastEntry: new Date(2026, 5, 1) },
        { tag: 'stale', due: '', lastEntry: new Date(2025, 10, 1) },
        { tag: 'idle', due: '' },
        { tag: 'past', due: '2026-03-02' },
        { tag: 'now', due: '2026-06-20' },
        { tag: 'soon', due: '2026-09-30' },
        { tag: 'far', due: '2027-01-05' },
        { tag: 'old', due: '2025-12-31' }
    ];
    const current = groupProjectsByMonth(projects, { now });
    TestRunner.assertEquals(current.undated.map(p => p.tag).join(), 'none', 'stale/no-entry undated excluded');
    TestRunner.assertEquals(current.months.map(m => m.key).join(), '2026-03,2026-06,2026-09');
    TestRunner.assert(current.hasEarlier && current.hasLater, 'paging flags');
    const later = groupProjectsByMonth(projects, { now, offset: 1 });
    TestRunner.assertEquals(later.months.map(m => m.projects[0].tag).join(), 'far');
    TestRunner.assertEquals(later.undated.length, 0, 'undated last entry outside window excluded');
    TestRunner.assert(!later.hasLater && later.hasEarlier);
    const earlier = groupProjectsByMonth(projects, { now, offset: -1 });
    TestRunner.assertEquals(earlier.months.map(m => m.projects[0].tag).join(), 'old');
    TestRunner.assertEquals(earlier.undated.map(p => p.tag).join(), 'stale', 'undated shown in window of its last entry');
});

// ── Pages ────────────────────────────────────────────────────────────────────

TestRunner.test('projects page: shows timeline, undated group, paging and detail', async () => {
    await seed({
        tasks: [
            { exid: 'pv1', description: 'Design', project: 'pv_site', due: dueIn(1), complete: true, estimate: '2' },
            { exid: 'pv2', description: 'Build', project: 'pv_site', estimate: '3' },
            { exid: 'pv_sub', description: 'Sub project task', project: 'pv_site', due: dueIn(2) },
            { exid: 'pv3', description: 'Sub work', project: 'pv_sub' },
            { exid: 'pv4', description: 'Loose', project: 'pv-misc' },
            { exid: 'pv6', description: 'Abandoned', project: 'pv_stale' },
            { exid: 'pv5', description: 'Way later', project: 'pv_future', due: dueIn(8), archived: true }
        ],
        entries: [hoursEntry(9001, 'pv1', 1.5), hoursEntry(9002, 'pv3', 1), hoursEntry(9003, 'pv4', 0.5),
            hoursEntry(9004, 'pv6', 1, 400)]
    });

    const page = document.createElement('projects-page');
    const detail = document.createElement('project-detail');
    appContext.append(page, detail);
    window.location.hash = '#projects';
    window.dispatchEvent(new Event('hashchange'));
    await wait(300);

    const undated = page.querySelector('[data-undated]');
    TestRunner.assert(!undated.hidden, 'undated group shown');
    TestRunner.assert(!undated.open, 'undated group collapsed by default');
    TestRunner.assertEquals(undated.querySelector('summary').textContent, 'No due date (1)');
    TestRunner.assert(undated.textContent.includes('pv misc'), 'undated project listed by display name');
    TestRunner.assert(!undated.textContent.includes('pv stale'), 'undated project with old last entry excluded');

    const cards = [...page.querySelectorAll('[data-months] .project-card')];
    TestRunner.assertEquals(cards.length, 1, 'only top-level dated project on the timeline (child nested)');
    const site = cards[0];
    TestRunner.assert(site.textContent.includes('pv site'), 'project name');
    TestRunner.assert(site.querySelector('.project-card__children').textContent.includes('pv sub'), 'child listed in card');
    TestRunner.assertEquals(site.querySelector('[data-progress]').textContent, '1/3 done');
    TestRunner.assertEquals(site.querySelector('[data-time]').textContent, '2.5h / 5.8h');
    TestRunner.assertEquals(site.querySelector('time').dateTime, dueIn(2), 'due = furthest incl. child');
    TestRunner.assert(!page.textContent.includes('pv future'), 'far future project paged out');

    const later = page.querySelector('[data-action="later"]');
    TestRunner.assert(!later.hidden, 'Later button shown');
    later.click();
    await wait(300);
    TestRunner.assert(page.textContent.includes('pv future'), 'next page shows far future (archived) project');
    TestRunner.assert(page.querySelector('[data-undated]').hidden, 'no undated activity in later window');
    page.querySelector('[data-action="earlier"]').click();
    await wait(300);

    appContext.tasks.value = [{ exid: 'pv2', description: 'Build', project: 'pv_site' }];
    window.location.hash = '#project/pv_site';
    window.dispatchEvent(new Event('hashchange'));
    await wait(300);
    TestRunner.assert(!detail.querySelector('[data-found]').hidden, 'detail found');
    TestRunner.assertEquals(detail.querySelector('[data-name]').textContent, 'pv site');
    TestRunner.assertEquals(detail.querySelector('[data-stat="progress"]').textContent, '1/3 done (33%)');
    const taskItems = [...detail.querySelectorAll('.project-detail__tasks li')];
    TestRunner.assertEquals(taskItems.length, 2, 'member tasks listed (child project dedicated task excluded)');
    TestRunner.assert(taskItems.some(li => li.classList.contains('project-detail__task--done')), 'completed task styled');
    TestRunner.assert(detail.querySelector('.project-detail__tasks a[href="#task/pv2"]'), "today's task links to editor");
    TestRunner.assert(detail.querySelector('[data-children]').textContent.includes('pv sub'), 'sub-project shown');

    window.location.hash = '#project/nope';
    window.dispatchEvent(new Event('hashchange'));
    await wait(300);
    TestRunner.assert(!detail.querySelector('[data-missing]').hidden, 'unknown project shows not found');

    page.remove();
    detail.remove();
    appContext.tasks.value = [];
    window.location.hash = '';
});
