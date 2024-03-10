/**
 * Calculates the duration between two dates.
 * @param {{ start: Date, end: Date, duration: number }} options - The options object.
 * @param {Date} options.start - The start date.
 * @param {Date} options.end - The end date.
 * @param {number} [options.duration=null] - The duration in milliseconds.
 * @returns {number} The duration in seconds.
 */
export default function calcDuration({ start = null, end = null, duration = null }) {
    const milliseconds = duration || (start && end ?  end.getTime() - start.getTime() : 0);
    return  formatDurationDecimal(milliseconds) 
}

export function formatDurationDecimal(duration) {
    const HOUR = 60 * 60 * 1000;
    return toFixedFloat(Math.ceil((duration / HOUR) * 1000) / 1000)
}

export function toFixedFloat(x) {
    return parseFloat(x.toFixed(3))
}