/**
 * A custom element that renders a line graph with axes, ticks, and data points.
 * 
 * @example
 * <!-- Basic usage -->
 * <graph-chart width="600" height="200" padding="40"></graph-chart>
 * 
 * @example
 * <!-- With data and custom labels -->
 * <graph-chart 
 *   width="600" 
 *   height="200" 
 *   padding="40"
 *   x-label="Time"
 *   y-label="Value"
 * ></graph-chart>
 * 
 * @example
 * <!-- With data -->
 * <script>
 *   const chart = document.querySelector('graph-chart');
 *   chart.data = [
 *     { x: 1, y: 5.2 },
 *     { x: 2, y: 3.8 },
 *     { x: 3, y: 7.1 }
 *   ];
 * </script>
 * 
 * @example
 * <!-- Responsive sizing -->
 * <graph-chart width="100%" height="300px"></graph-chart>
 */
export default class GraphChart extends HTMLElement {
    /**
     * Creates a new GraphChart instance.
     * Initializes with default dimensions and empty data array.
     */
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._data = [];
        this._width = 600;
        this._height = 400;
        this._padding = 40;
        this._xLabel = 'X Axis';
        this._yLabel = 'Y Axis';
        this.render();
    }

    /**
     * List of attributes that trigger a re-render when changed.
     * @returns {string[]} Array of observed attribute names
     */
    static get observedAttributes() {
        return ['width', 'height', 'padding', 'x-label', 'y-label'];
    }

    /**
     * Handles attribute changes and updates the graph accordingly.
     * @param {string} name - The name of the changed attribute
     * @param {string} oldValue - The previous value
     * @param {string} newValue - The new value
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            switch (name) {
                case 'width':
                    this._width = parseInt(newValue) || 600;
                    break;
                case 'height':
                    this._height = parseInt(newValue) || 400;
                    break;
                case 'padding':
                    this._padding = parseInt(newValue) || 40;
                    break;
                case 'x-label':
                    this._xLabel = newValue || 'X Axis';
                    break;
                case 'y-label':
                    this._yLabel = newValue || 'Y Axis';
                    break;
            }
            this.render();
        }
    }

    /**
     * Sets the data to be displayed in the graph.
     * @param {Array<{x: number, y: number}>} value - Array of data points
     * @example
     * chart.data = [
     *   { x: 1, y: 5.2 },
     *   { x: 2, y: 3.8 },
     *   { x: 3, y: 7.1 }
     * ];
     */
    set data(value) {
        this._data = value;
        this.render();
    }

    /**
     * Gets the current data array.
     * @returns {Array<{x: number, y: number}>} Array of data points
     */
    get data() {
        return this._data;
    }

    /**
     * Calculates the minimum and maximum values for both axes.
     * @returns {{minX: number, maxX: number, minY: number, maxY: number}} Object containing min/max values
     */
    getMinMax() {
        if (!this._data.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        
        return {
            minX: Math.min(...this._data.map(d => d.x)),
            maxX: Math.max(...this._data.map(d => d.x)),
            minY: Math.min(...this._data.map(d => d.y)),
            maxY: Math.max(...this._data.map(d => d.y))
        };
    }

    /**
     * Scales a data point to fit within the graph's dimensions.
     * @param {{x: number, y: number}} point - The data point to scale
     * @param {{minX: number, maxX: number, minY: number, maxY: number}} minMax - The min/max values
     * @returns {{x: number, y: number}} Scaled point coordinates
     */
    scalePoint(point, minMax) {
        const xScale = (this._width - this._padding * 2) / (minMax.maxX - minMax.minX || 1);
        const yScale = (this._height - this._padding * 2) / (minMax.maxY - minMax.minY || 1);

        return {
            x: (point.x - minMax.minX) * xScale + this._padding,
            y: this._height - ((point.y - minMax.minY) * yScale + this._padding)
        };
    }

    /**
     * Creates the SVG path string for the data line.
     * @returns {string} SVG path string
     */
    createPath() {
        if (!this._data.length) return '';
        
        const minMax = this.getMinMax();
        const points = this._data.map(point => this.scalePoint(point, minMax));
        
        return points.reduce((path, point, i) => {
            return path + (i === 0 ? `M ${point.x},${point.y}` : ` L ${point.x},${point.y}`);
        }, '');
    }

    /**
     * Creates the axis lines for the graph.
     * @param {{minX: number, maxX: number, minY: number, maxY: number}} minMax - The min/max values
     * @returns {{xAxis: Object, yAxis: Object}} Object containing axis coordinates
     */
    createAxis(minMax) {
        const xAxis = {
            x1: this._padding,
            y1: this._height - this._padding,
            x2: this._width - this._padding,
            y2: this._height - this._padding
        };

        const yAxis = {
            x1: this._padding,
            y1: this._padding,
            x2: this._padding,
            y2: this._height - this._padding
        };

        return { xAxis, yAxis };
    }

    /**
     * Creates tick marks and labels for both axes.
     * @param {{minX: number, maxX: number, minY: number, maxY: number}} minMax - The min/max values
     * @returns {{xTicks: Array, yTicks: Array}} Object containing tick mark data
     */
    createTicks(minMax) {
        // Helper function to determine appropriate decimal places
        const getDecimalPlaces = (min, max) => {
            const range = max - min;
            if (range === 0) return 0;
            
            // For very small ranges, use more decimal places
            if (range < 0.0001) return 5;
            if (range < 0.001) return 4;
            if (range < 0.01) return 3;
            if (range < 0.1) return 2;
            
            // For larger ranges, use whole numbers
            return 0;
        };

        // Helper function to generate ticks for an axis
        const generateTicks = (min, max, numTicks, isYAxis = false) => {
            const ticks = [];
            const decimalPlaces = getDecimalPlaces(min, max);
            
            for (let i = 0; i <= numTicks; i++) {
                const value = min + (max - min) * (i / numTicks);
                const formattedValue = decimalPlaces === 0 
                    ? Math.round(value)
                    : value.toFixed(decimalPlaces);
                
                if (isYAxis) {
                    const scaledY = this.scalePoint({ x: min, y: value }, minMax).y;
                    ticks.push({
                        x: this._padding,
                        y: scaledY,
                        value: formattedValue
                    });
                } else {
                    const scaledX = this.scalePoint({ x: value, y: min }, minMax).x;
                    ticks.push({
                        x: scaledX,
                        y: this._height - this._padding,
                        value: formattedValue
                    });
                }
            }
            return ticks;
        };

        // Helper function to check for duplicates
        const hasDuplicates = (ticks) => {
            const values = ticks.map(t => t.value);
            return values.length !== new Set(values).size;
        };

        // Generate X-axis ticks with duplicate checking
        let numXTicks = 5;
        let xTicks;
        do {
            xTicks = generateTicks(minMax.minX, minMax.maxX, numXTicks);
            numXTicks--;
        } while (hasDuplicates(xTicks) && numXTicks > 1);

        // Generate Y-axis ticks with duplicate checking
        let numYTicks = 5;
        let yTicks;
        do {
            yTicks = generateTicks(minMax.minY, minMax.maxY, numYTicks, true);
            numYTicks--;
        } while (hasDuplicates(yTicks) && numYTicks > 1);

        return { xTicks, yTicks };
    }

    /**
     * Renders the graph with all its components.
     * Creates SVG elements for:
     * - Axes
     * - Tick marks and labels
     * - Data line
     * - Data points
     * - Axis labels
     */
    render() {
        const minMax = this.getMinMax();
        const { xAxis, yAxis } = this.createAxis(minMax);
        const { xTicks, yTicks } = this.createTicks(minMax);
        const path = this.createPath();

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                .graph {
                    width: 100%;
                    height: 100%;
                }
                .axis {
                    stroke: var(--color-chart-axis-line);
                    stroke-width: 1;
                }
                .tick {
                    stroke: var(--color-chart-tick);
                    stroke-width: 1;
                }
                .tick-label {
                    font-size: 12px;
                    fill: var(--color-chart-tick-label);
                    text-anchor: middle;
                }
                .y-tick-label {
                    text-anchor: end;
                }
                .data-line {
                    fill: none;
                    stroke: var(--color-chart-primary);
                    stroke-width: 2;
                }
                .point {
                    fill: var(--color-chart-point);
                    stroke: var(--color-chart-point);
                    stroke-width: 1;
                }
                .point:hover {
                    fill: var(--color-chart-point-hover);
                    stroke: var(--color-chart-point-hover);
                }
                .axis-label {
                    font-size: 14px;
                    fill: var(--color-chart-axis-label);
                    text-anchor: middle;
                }
                .grid-line {
                    stroke: var(--color-chart-grid-line);
                    stroke-width: 1;
                    stroke-dasharray: 4,4;
                }
            </style>
            <svg class="graph" viewBox="0 0 ${this._width} ${this._height}">
                <!-- Axes -->
                <line class="axis" 
                    x1="${xAxis.x1}" 
                    y1="${xAxis.y1}" 
                    x2="${xAxis.x2}" 
                    y2="${xAxis.y2}" 
                />
                <line class="axis" 
                    x1="${yAxis.x1}" 
                    y1="${yAxis.y1}" 
                    x2="${yAxis.x2}" 
                    y2="${yAxis.y2}" 
                />
                
                <!-- X-axis ticks and labels -->
                ${xTicks.map(tick => `
                    <line class="tick" 
                        x1="${tick.x}" 
                        y1="${tick.y}" 
                        x2="${tick.x}" 
                        y2="${tick.y + 5}" 
                    />
                    <text class="tick-label" 
                        x="${tick.x}" 
                        y="${tick.y + 20}"
                    >${tick.value}</text>
                `).join('')}

                <!-- Y-axis ticks and labels -->
                ${yTicks.map(tick => `
                    <line class="tick" 
                        x1="${tick.x}" 
                        y1="${tick.y}" 
                        x2="${tick.x - 5}" 
                        y2="${tick.y}" 
                    />
                    <text class="tick-label y-tick-label" 
                        x="${tick.x - 10}" 
                        y="${tick.y}"
                    >${tick.value}</text>
                `).join('')}

                <!-- Axis labels -->
                <text class="axis-label" 
                    x="${this._width / 2}" 
                    y="${this._height - 5}"
                >${this._xLabel}</text>
                <text class="axis-label" 
                    x="15" 
                    y="${this._height / 2}"
                    transform="rotate(-90, 15, ${this._height / 2})"
                >${this._yLabel}</text>

                <!-- Data line and points -->
                <path class="data-line" d="${path}" />
                ${this._data.map(point => {
                    const scaledPoint = this.scalePoint(point, minMax);
                    return `<circle class="point" cx="${scaledPoint.x}" cy="${scaledPoint.y}" r="4" />`;
                }).join('')}
            </svg>
        `;
    }
}

customElements.define('graph-chart', GraphChart); 