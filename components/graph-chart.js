export default class GraphChart extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._data = [];
        this._width = 600;
        this._height = 200;
        this._padding = 40;
        this._xLabel = 'X Axis';
        this._yLabel = 'Y Axis';
        this._goal = 0;
        this.render();
    }

    static get observedAttributes() {
        return ['width', 'height', 'padding', 'x-label', 'y-label', 'goal'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        switch (name) {
            case 'width':   this._width   = parseInt(newValue) || 600; break;
            case 'height':  this._height  = parseInt(newValue) || 200; break;
            case 'padding': this._padding = parseInt(newValue) || 40;  break;
            case 'x-label': this._xLabel  = newValue || 'X Axis';      break;
            case 'y-label': this._yLabel  = newValue || 'Y Axis';      break;
            case 'goal':    this._goal    = parseFloat(newValue) || 0;  break;
        }
        this.render();
    }

    set data(value) {
        this._data = value;
        this.render();
    }

    get data() {
        return this._data;
    }

    getMinMax() {
        if (!this._data.length) return { minX: 0, maxX: 1, minY: 0, maxY: Math.max(this._goal, 1) };
        return {
            minX: Math.min(...this._data.map(d => d.x)),
            maxX: Math.max(...this._data.map(d => d.x)),
            minY: 0, // always start at zero for time/task data
            maxY: Math.max(...this._data.map(d => d.y), this._goal, 0.1)
        };
    }

    scalePoint(point, minMax) {
        const xRange = minMax.maxX - minMax.minX || 1;
        const yRange = minMax.maxY - minMax.minY || 1;
        const xScale = (this._width - this._padding * 2) / xRange;
        const yScale = (this._height - this._padding * 2) / yRange;
        return {
            x: (point.x - minMax.minX) * xScale + this._padding,
            y: this._height - ((point.y - minMax.minY) * yScale + this._padding)
        };
    }

    createLinePath(minMax) {
        if (!this._data.length) return '';
        const points = this._data.map(p => this.scalePoint(p, minMax));
        return points.reduce((path, pt, i) =>
            path + (i === 0 ? `M ${pt.x},${pt.y}` : ` L ${pt.x},${pt.y}`), '');
    }

    createAreaPath(minMax) {
        if (!this._data.length) return '';
        const points = this._data.map(p => this.scalePoint(p, minMax));
        const baseline = this._height - this._padding;
        const linePath = points.reduce((p, pt, i) =>
            p + (i === 0 ? `M ${pt.x},${pt.y}` : ` L ${pt.x},${pt.y}`), '');
        return `${linePath} L ${points[points.length - 1].x},${baseline} L ${points[0].x},${baseline} Z`;
    }

    createTicks(minMax) {
        const xRange = minMax.maxX - minMax.minX;
        const yRange = minMax.maxY;

        // X-axis: integer ticks, max 8, spaced by 1, 2, 5, or 10
        const xStep = xRange <= 8 ? 1 : xRange <= 16 ? 2 : xRange <= 40 ? 5 : 10;
        const xTicks = [];
        for (let v = Math.ceil(minMax.minX / xStep) * xStep; v <= minMax.maxX; v += xStep) {
            const scaled = this.scalePoint({ x: v, y: 0 }, minMax);
            xTicks.push({ x: scaled.x, y: this._height - this._padding, value: v });
        }

        // Y-axis: 5 ticks, nice round numbers
        const rawStep = yRange / 4;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
        const niceStep = Math.ceil(rawStep / magnitude) * magnitude || 1;
        const yTicks = [];
        for (let v = 0; v <= minMax.maxY + niceStep * 0.01; v += niceStep) {
            const scaled = this.scalePoint({ x: 0, y: v }, minMax);
            if (scaled.y < this._padding - 5) break;
            yTicks.push({ x: this._padding, y: scaled.y, value: Math.round(v * 10) / 10 });
        }

        return { xTicks, yTicks };
    }

    render() {
        const minMax = this.getMinMax();
        const { xTicks, yTicks } = this.createTicks(minMax);
        const linePath = this.createLinePath(minMax);
        const areaPath = this.createAreaPath(minMax);

        const goalLineHTML = this._goal > 0 ? (() => {
            const goalY = this.scalePoint({ x: minMax.minX, y: this._goal }, minMax).y;
            return `
                <line class="goal-line"
                    x1="${this._padding}" y1="${goalY}"
                    x2="${this._width - this._padding}" y2="${goalY}" />
                <text class="goal-label"
                    x="${this._width - this._padding + 4}" y="${goalY + 4}"
                >${this._goal}</text>`;
        })() : '';

        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                svg { width: 100%; height: auto; display: block; }
                .axis { stroke: var(--color-chart-axis-line); stroke-width: 1; }
                .tick { stroke: var(--color-chart-tick); stroke-width: 1; }
                .tick-label { font-size: 11px; fill: var(--color-chart-tick-label); text-anchor: middle; }
                .y-tick-label { text-anchor: end; }
                .grid-line { stroke: var(--color-chart-grid-line); stroke-width: 1; stroke-dasharray: 4,4; }
                .area-fill { fill: var(--color-chart-area); stroke: none; }
                .data-line { fill: none; stroke: var(--color-chart-primary); stroke-width: 2; stroke-linejoin: round; }
                .point { fill: var(--color-chart-point); stroke: none; }
                .point:hover { fill: var(--color-chart-point-hover); r: 5; }
                .axis-label { font-size: 12px; fill: var(--color-chart-axis-label); text-anchor: middle; }
                .goal-line { stroke: var(--color-chart-goal, rgba(255,200,50,0.75)); stroke-width: 1.5; stroke-dasharray: 6,3; }
                .goal-label { font-size: 10px; fill: var(--color-chart-goal, rgba(255,200,50,0.75)); dominant-baseline: middle; }
            </style>
            <svg viewBox="0 0 ${this._width} ${this._height}">
                <!-- Y-axis grid lines -->
                ${yTicks.map(tick => `
                    <line class="grid-line"
                        x1="${this._padding}" y1="${tick.y}"
                        x2="${this._width - this._padding}" y2="${tick.y}" />
                `).join('')}

                <!-- Area fill -->
                <path class="area-fill" d="${areaPath}" />

                <!-- Goal line -->
                ${goalLineHTML}

                <!-- Data line -->
                <path class="data-line" d="${linePath}" />

                <!-- Data points -->
                ${this._data.map(point => {
                    const scaled = this.scalePoint(point, minMax);
                    return `<circle class="point" cx="${scaled.x}" cy="${scaled.y}" r="3" />`;
                }).join('')}

                <!-- Axes -->
                <line class="axis"
                    x1="${this._padding}" y1="${this._padding}"
                    x2="${this._padding}" y2="${this._height - this._padding}" />
                <line class="axis"
                    x1="${this._padding}" y1="${this._height - this._padding}"
                    x2="${this._width - this._padding}" y2="${this._height - this._padding}" />

                <!-- X-axis ticks and labels -->
                ${xTicks.map(tick => `
                    <line class="tick"
                        x1="${tick.x}" y1="${tick.y}"
                        x2="${tick.x}" y2="${tick.y + 4}" />
                    <text class="tick-label"
                        x="${tick.x}" y="${tick.y + 15}">${tick.value}</text>
                `).join('')}

                <!-- Y-axis ticks and labels -->
                ${yTicks.map(tick => `
                    <line class="tick"
                        x1="${tick.x}" y1="${tick.y}"
                        x2="${tick.x - 4}" y2="${tick.y}" />
                    <text class="tick-label y-tick-label"
                        x="${tick.x - 8}" y="${tick.y + 4}">${tick.value}</text>
                `).join('')}

                <!-- Axis labels -->
                <text class="axis-label"
                    x="${this._width / 2}" y="${this._height - 2}">${this._xLabel}</text>
                <text class="axis-label"
                    x="12" y="${this._height / 2}"
                    transform="rotate(-90, 12, ${this._height / 2})">${this._yLabel}</text>
            </svg>
        `;
    }
}

customElements.define('graph-chart', GraphChart);
