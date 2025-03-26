/**
 * Extracts hue from an HSL/HSLA color string
 * @param {string} color - HSL/HSLA color string
 * @returns {number|null} - Hue value (0-360) or null if invalid
 */
export function extractHue(color) {
    const hueMatch = color.match(/hsla?\((\d+)/);
    return hueMatch ? parseInt(hueMatch[1]) : null;
}

/**
 * Creates a new HSL/HSLA color with offset hue
 * @param {string} color - Original HSL/HSLA color string
 * @param {number} offsetDegrees - Degrees to offset the hue (0-360)
 * @returns {string} - New color string with offset hue
 */
export function offsetHue(color, offsetDegrees) {
    const hue = extractHue(color);
    if (hue === null) return color;
    
    const offsetHue = (hue + offsetDegrees) % 360;
    return color.replace(/hsla?\(\d+/, `hsla(${offsetHue}`);
}

/**
 * Converts a hex color to HSLA format
 * @param {string} hex - Hex color string (e.g. "#FF0000" or "FF0000")
 * @param {number} [alpha=0.6] - Alpha value between 0 and 1
 * @returns {string} - HSLA color string
 */
export function hexToHsla(hex, alpha = 0.6) {
    // Remove the hash if present
    hex = hex.replace(/^#/, '');
    
    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    // Find min and max values
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    // Calculate hue
    let h;
    if (max === min) {
        h = 0;
    } else if (max === r) {
        h = 60 * (((g - b) / (max - min)) % 6);
    } else if (max === g) {
        h = 60 * ((b - r) / (max - min) + 2);
    } else {
        h = 60 * ((r - g) / (max - min) + 4);
    }
    
    // Ensure hue is positive
    if (h < 0) h += 360;
    
    // Calculate saturation and lightness
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    
    // Convert to percentages
    const sPercent = Math.round(s * 100);
    const lPercent = Math.round(l * 100);
    
    return `hsla(${Math.round(h)}, ${sPercent}%, ${lPercent}%, ${alpha})`;
} 