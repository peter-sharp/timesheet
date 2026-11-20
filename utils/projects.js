// Derives project summaries from todo.txt-style tasks.
// A project is any `+tag`. A task whose exid equals the tag is the project's
// dedicated task (optional); its own `+parent` tag nests the project under that parent.
// Stored projects (created from the projects page) add tags with no tasks yet and
// supply fallback `due`/`parent` when there's no dedicated task.
import { taskEstimate } from './estimate.js';

export const projectName = (tag = '') => tag.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

const isComplete = (task) => !!task.complete || task.status === 'complete';
const latest = (dates) => dates.filter(Boolean).sort().at(-1) || '';

/**
 * @param {Array} tasks all (non-deleted) tasks
 * @param {Object} hoursByExid all-time tracked hours keyed by task exid
 * @param {Object} lastEntryByExid most recent time entry (Date) keyed by task exid
 * @param {Array} stored projects from the projects store: { tag, due, parent, created }
 * @returns {Array} top-level projects; nested projects live in `children`
 */
export function buildProjects(tasks = [], hoursByExid = {}, lastEntryByExid = {}, stored = []) {
    const storedByTag = Object.fromEntries(stored.filter(p => p?.tag).map(p => [p.tag, p]));
    const tags = [...new Set([...tasks.map(t => t.project), ...Object.keys(storedByTag)].filter(Boolean))];
    const tagSet = new Set(tags);
    const dedicated = Object.fromEntries(
        tasks.filter(t => t.exid && tagSet.has(String(t.exid))).map(t => [String(t.exid), t])
    );
    const parentOf = (tag) => {
        const parent = dedicated[tag]?.project || storedByTag[tag]?.parent;
        return parent && parent !== tag ? parent : '';
    };

    const build = (tag, seen) => {
        const task = dedicated[tag] || null;
        const childTags = tags.filter(t => parentOf(t) === tag && !seen.has(t));
        const nextSeen = new Set([...seen, tag, ...childTags]);
        const children = childTags.map(t => build(t, nextSeen));
        // Dedicated tasks of child projects are counted through the child
        const members = tasks.filter(t => t.project === tag && !childTags.includes(String(t.exid)));
        const own = {
            count: members.length,
            done: members.filter(isComplete).length,
            estimate: members.reduce((sum, t) => sum + taskEstimate(t), 0),
            hours: members.reduce((sum, t) => sum + (hoursByExid[t.exid] || 0), 0)
                + (task ? hoursByExid[task.exid] || 0 : 0)
        };
        const sum = (key) => children.reduce((total, c) => total + c[key], own[key]);
        const entryDates = [...members, ...(task ? [task] : [])].map(t => lastEntryByExid[t.exid])
            .concat(children.map(c => c.lastEntry), storedByTag[tag]?.created)
            .filter(Boolean)
            .map(d => new Date(d));
        const count = sum('count');
        const done = sum('done');
        return {
            tag,
            name: projectName(tag),
            task,
            parent: parentOf(tag),
            tasks: members,
            children,
            count,
            done,
            progress: count ? done / count : 0,
            estimate: sum('estimate'),
            hours: sum('hours'),
            lastEntry: entryDates.length ? new Date(Math.max(...entryDates)) : null,
            due: task?.due || storedByTag[tag]?.due || latest([...members.map(t => t.due), ...children.map(c => c.due)])
        };
    };

    // Parent chain of a tag; `looped` when it cycles back on itself
    const chain = (tag, path = []) => {
        if (path.includes(tag)) return { path: path.slice(path.indexOf(tag)), looped: true };
        const parent = parentOf(tag);
        // A parent tag with no tasks of its own isn't a project: treat as root
        return parent && tagSet.has(parent) ? chain(parent, [...path, tag]) : { path: [...path, tag], looped: false };
    };
    // Roots: no (known) parent, or the alphabetically first member of a parent cycle
    const isRoot = (tag) => {
        const parent = parentOf(tag);
        if (!parent || !tagSet.has(parent)) return true;
        const { path, looped } = chain(tag);
        return looped && path.includes(tag) && [...path].sort()[0] === tag;
    };
    return tags.filter(isRoot).map(t => build(t, new Set()));
}

// Every project tag, depth first (top-level then its sub-projects)
export const flattenProjects = (projects = []) =>
    projects.flatMap(project => [project, ...flattenProjects(project.children)]);

// Datalist options for a project field: known project tags first, then task exids
// (tagging a task's exid as a project turns that task into the project's dedicated task)
export const projectOptions = (projects = [], tasks = []) => {
    const tags = flattenProjects(projects).map(p => p.tag);
    const known = new Set(tags);
    const exids = tasks.map(t => String(t.exid || '')).filter(exid => exid && !known.has(exid));
    return [...new Set([...tags, ...exids])];
};

export function findProject(projects = [], tag) {
    for (const project of projects) {
        if (project.tag === tag) return project;
        const found = findProject(project.children, tag);
        if (found) return found;
    }
    return null;
}

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const parseDue = (due) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(due || '');
    return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
};

/**
 * Groups dated projects into months within a 7-month window centred on now
 * (3 months back, 3 months forward). Each `offset` step shifts by one window.
 * Undated projects are listed only when their last time entry falls in the window.
 */
export function groupProjectsByMonth(projects = [], { offset = 0, now = new Date() } = {}) {
    const start = new Date(now.getFullYear(), now.getMonth() - 3 + offset * 7, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 4 + offset * 7, 0, 23, 59, 59, 999);
    const dated = projects
        .map(project => ({ project, date: parseDue(project.due) }))
        .filter(x => x.date)
        .sort((a, b) => a.date - b.date);
    // Undated projects are kept only while their last time entry falls in the window
    const undatedActive = projects
        .filter(p => !parseDue(p.due) && p.lastEntry)
        .map(project => ({ project, date: new Date(project.lastEntry) }));
    const inWindow = dated.filter(x => x.date >= start && x.date <= end);
    const months = inWindow.reduce((groups, { project, date }) => {
        const key = monthKey(date);
        const group = groups.find(g => g.key === key);
        if (group) group.projects.push(project);
        else groups.push({
            key,
            label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
            projects: [project]
        });
        return groups;
    }, []);
    return {
        start,
        end,
        undated: undatedActive.filter(x => x.date >= start && x.date <= end).map(x => x.project),
        months,
        hasEarlier: [...dated, ...undatedActive].some(x => x.date < start),
        hasLater: [...dated, ...undatedActive].some(x => x.date > end)
    };
}
