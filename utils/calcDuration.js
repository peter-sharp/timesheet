//TODO rename module to duration
import zeroPad from "./zeroPad.js";
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

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

/**
 * TODO: Rename to millisecondsToHours
 * Calculates the hourly duration from given duration in milliseconds
 * @param {number} duration - The duration in milliseconds.
 * @returns {number} The duration in hours 
 */
export function formatDurationDecimal(duration) {
    return toFixedFloat(Math.ceil((duration / HOUR_IN_MILLISECONDS) * 1000) / 1000)
}

/**
 * Calculates the hourly duration from given duration in milliseconds
 * @param {number} duration - The duration in milliseconds.
 * @returns {number} The duration in hours 
 */
export function hoursToMilliseconds(hours) {
    
    return hours * HOUR_IN_MILLISECONDS;
}

export function toFixedFloat(x) {
    return parseFloat(x.toFixed(3))
}



const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60

/**
* Formats a duration between two dates as a string in the standard format of "HH:mm".
* @param {{start: Date, end: Date, duration: integer}} duration - The duration to format, represented as an object with start and end properties, both of type Date.
* @returns {string} The formatted duration, with a negative sign if the duration is negative.
*/
export function formatDurationToStandard ({ start = null, end = null, duration = null }) {
  const milliseconds  = duration || (start && end ?  end.getTime() - start.getTime() : 0);
 return `${milliseconds < 0 ? '-' : ''} ${Math.floor(millisecondsToHours(milliseconds))}:${zeroPad(2, getRemainingMinutes(milliseconds))}:${zeroPad(2, getRemainingSeconds(milliseconds))}`

}

function millisecondsToHours(milliseconds) {
  return milliseconds && Math.floor(milliseconds / MILLISECONDS_PER_SECOND / SECONDS_PER_MINUTE / MINUTES_PER_HOUR);
}

function getRemainingMinutes(milliseconds) {
  return milliseconds && Math.floor(milliseconds / MILLISECONDS_PER_SECOND / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR;
}

function getRemainingSeconds(milliseconds) {
  return milliseconds && Math.floor(milliseconds / MILLISECONDS_PER_SECOND ) % SECONDS_PER_MINUTE;
}