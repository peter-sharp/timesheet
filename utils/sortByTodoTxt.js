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

    // TODO: within the same priority bucket, respect original list insertion order
    //       once we persist a stable sequence number on tasks.

    // Secondary: creation date ascending (oldest tasks first)
    const aTime = a.creationDate
        ? new Date(a.creationDate).getTime()
        : new Date(a.mostRecentEntry || 0).getTime();
    const bTime = b.creationDate
        ? new Date(b.creationDate).getTime()
        : new Date(b.mostRecentEntry || 0).getTime();

    return aTime - bTime;
}
