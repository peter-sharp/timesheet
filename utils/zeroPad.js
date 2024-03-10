
/**
 * Pads a number with leading zeros to a specified length.
 * @param {number} length - The desired length of the padded number.
 * @param {number} number - The number to be padded.
 * @returns {string} The padded number.
 */
export default  function zeroPad(length = 2, number) {
    return String(number).padStart(length, '0')
}