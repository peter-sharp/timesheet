import calcDuration from "./calcDuration.js";

export function calculateGaps(state) {
    //calc gaps
    state.entries = state.entries.map(function calculateGap(entry, i, entries) {
        const prevEntry = entries[i - 1];
        let gap;
        if (prevEntry) {
            gap = calcDuration({ start: prevEntry.end, end: entry.start });
        }
        return { ...entry, gap };
    });
    return state;
}
export default calculateGaps;