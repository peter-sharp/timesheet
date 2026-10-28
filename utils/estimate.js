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

// Hours of estimate left: estimate minus all-time hours (today's total + previous days), never below 0
export function remainingEstimate(task, pastHours = 0) {
    return Math.max(0, taskEstimate(task) - (task?.total || 0) - (pastHours || 0));
}
