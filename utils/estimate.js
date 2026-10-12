// Default estimate (hours) applied to tasks without an explicit estimate: add-on.
// Implicit only: never written back to todo.txt.
export const DEFAULT_ESTIMATE = 0.8;

export function taskEstimate(task) {
    const estimate = parseFloat(task?.estimate);
    return estimate > 0 ? estimate : DEFAULT_ESTIMATE;
}

export function isEstimateMet(totalHours, task) {
    return totalHours <= taskEstimate(task);
}
