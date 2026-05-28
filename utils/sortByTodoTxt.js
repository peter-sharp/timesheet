/**
 * Sort comparator implementing the todo.txt ordering:
 *   1. Incomplete tasks before completed tasks
 *   2. Among incomplete: by priority (A < B < C < ... < no priority)
 *   3. Within same priority: by creationDate ascending (oldest first),
 *      falling back to mostRecentEntry for tasks without a creationDate
 */
export default function sortByTodoTxt(a, b) {
    // Completed tasks always go last
    if (a.complete !== b.complete) {
        return a.complete ? 1 : -1;
    }

    // Among incomplete tasks: prioritised before unprioritised, then alphabetically
    if (!a.complete) {
        const ap = a.priority || null;
        const bp = b.priority || null;
        if (ap !== bp) {
            if (!ap) return 1;
            if (!bp) return -1;
            return ap < bp ? -1 : 1;
        }
    }

    // Secondary: creation date ascending (oldest tasks first)
    // Normalise to YYYY-MM-DD string — creationDate may be a Date object (app-created)
    // or a date string (imported from todo.txt); compare at day granularity per todo.txt spec
    const toDateStr = (val) => val instanceof Date
        ? val.toISOString().slice(0, 10)
        : val;

    const aDate = a.creationDate
        ? toDateStr(a.creationDate)
        : (a.mostRecentEntry ? toDateStr(new Date(a.mostRecentEntry)) : '');
    const bDate = b.creationDate
        ? toDateStr(b.creationDate)
        : (b.mostRecentEntry ? toDateStr(new Date(b.mostRecentEntry)) : '');

    if (aDate !== bDate) return aDate < bDate ? -1 : 1;

    // Tertiary: stable insertion order by id (millisecond timestamp set at creation)
    return (a.id || 0) - (b.id || 0);
}
