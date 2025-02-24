/**
 *  FIXME: we're doing too much here
 *  Calculates the hourly/millisecondly duration between two dates or duration in milliseconds
 * @param {{ start: Date, end: Date, duration: number }} options - The options object.
 * @param {Date} options.start - The start date.
 * @param {Date} options.end - The end date.
 * @param {number} [options.duration=null] - The duration in milliseconds.
 * @param {string} [unit='hours'] - type of duration, default is hours
 * @returns {number} The duration in hours or milliseconds.
 */
export default function calcDuration({ start = null, end = null, duration = null }, unit='hours') {
    const milliseconds = duration || (start && end ?  end.getTime() - start.getTime() : 0);
    return unit == 'hours' ? formatDurationDecimal(milliseconds) : milliseconds;
}
/**
 * TODO: Rename to millisecondsToHours
 * Calculates the hourly duration from given duration in milliseconds
 * @param {number} duration - The duration in milliseconds.
 * @returns {number} The duration in hours 
 */
export function formatDurationDecimal(duration) {
    const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
    return toFixedFloat(Math.ceil((duration / HOUR_IN_MILLISECONDS) * 1000) / 1000)
}

/**
 * Calculates the hourly duration from given duration in milliseconds
 * @param {number} duration - The duration in milliseconds.
 * @returns {number} The duration in hours 
 */
export function hoursToMilliseconds(hours) {
    const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
    return hours * HOUR_IN_MILLISECONDS;
}

export function toFixedFloat(x) {
    return parseFloat(x.toFixed(3))
}