const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

// Gaps shorter than this are noise, not something worth filling (matches the old 0.05h gap-text threshold)
export const MIN_GAP_MS = 3 * MS_PER_MINUTE;

const toDate = (x) => x instanceof Date ? x : new Date(x);
const floorHour = (d) => { const x = new Date(d); x.setMinutes(0, 0, 0); return x; };
const ceilHour = (d) => { const x = floorHour(d); return x.getTime() < d.getTime() ? new Date(x.getTime() + MS_PER_HOUR) : x; };

/**
 * Lays out a day's entries proportionally on a ribbon spanning whole hours.
 * @param {Array<{id:number, task:string, start:Date|string, end:Date|string}>} entries
 * @returns {{start: Date|null, end: Date|null, segments: Array<{id, task, start: Date, end: Date, left: number, width: number}>, gaps: Array<{beforeId, afterId, start: Date, end: Date, left: number, width: number}>, ticks: Array<{hour: number, left: number}>}}
 *   left/width are percentages of the ribbon.
 */
export default function dayRibbon(entries = []) {
    const timed = entries
        .filter((entry) => entry.start && entry.end)
        .map((entry) => ({ ...entry, start: toDate(entry.start), end: toDate(entry.end) }))
        .filter((entry) => entry.end > entry.start)
        .sort((a, b) => a.start - b.start);

    if (!timed.length) return { start: null, end: null, segments: [], gaps: [], ticks: [] };

    const start = floorHour(timed[0].start);
    const end = ceilHour(new Date(Math.max(...timed.map((entry) => entry.end.getTime()))));
    const span = end - start;
    const pct = (d) => (d - start) / span * 100;

    const segments = timed.map((entry) => ({
        id: entry.id,
        task: entry.task,
        start: entry.start,
        end: entry.end,
        left: pct(entry.start),
        width: (entry.end - entry.start) / span * 100
    }));

    // Unfilled stretches between entries. A running cursor of the furthest end seen so far means
    // overlapping or fully-contained entries never produce a phantom gap.
    const gaps = [];
    let cursor = timed[0];
    for (const entry of timed.slice(1)) {
        if (entry.start - cursor.end >= MIN_GAP_MS) {
            gaps.push({
                beforeId: cursor.id,
                afterId: entry.id,
                start: cursor.end,
                end: entry.start,
                left: pct(cursor.end),
                width: (entry.start - cursor.end) / span * 100
            });
        }
        if (entry.end > cursor.end) cursor = entry;
    }

    const ticks = Array.from({ length: Math.round(span / MS_PER_HOUR) + 1 }, (_, i) => {
        const tick = new Date(start.getTime() + i * MS_PER_HOUR);
        return { hour: tick.getHours(), left: pct(tick) };
    });

    return { start, end, segments, gaps, ticks };
}

/**
 * Stable colour for a task exid; hue from a string hash, lightness alternates so neighbours differ by more than hue.
 * @param {string} exid
 * @returns {string} CSS hsl() colour
 */
export function exidColor(exid = '') {
    const hash = [...String(exid)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const hue = (hash * 137) % 360;
    const lightness = [42, 58, 70][hash % 3];
    return `hsl(${hue}deg 65% ${lightness}%)`;
}

/**
 * Compact duration label, e.g. "7m", "1h", "2h 15m".
 * @param {number} ms
 * @returns {string}
 */
export function formatShortDuration(ms = 0) {
    const minutes = Math.max(0, Math.round(ms / MS_PER_MINUTE));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest}m`;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
