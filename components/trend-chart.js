// Combo chart: one bar per month (tasks completed, left axis), a dashed goal line,
// and a line for estimates-met % (right axis, 0–100).
// data: [{ label, tasksCompleted, estimatesMet, estimateRate|null }]
export default class TrendChart extends HTMLElement {
    #data = [];
    #goal = 0;
    #width = 600;
    #height = 220;
    #pad = { top: 16, right: 40, bottom: 32, left: 40 };

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    static get observedAttributes() { return ['goal']; }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'goal' && oldValue !== newValue) {
            this.#goal = parseFloat(newValue) || 0;
            this.render();
        }
    }

    set data(value) { this.#data = value || []; this.render(); }
    get data() { return this.#data; }

    render() {
        const { top, right, bottom, left } = this.#pad;
        const w = this.#width, h = this.#height;
        const plotW = w - left - right;
        const plotH = h - top - bottom;
        const baseY = top + plotH;
        const data = this.#data;
        const slot = data.length ? plotW / data.length : plotW;
        const barW = slot * 0.6;

        const maxTasks = niceMax(Math.max(this.#goal, ...data.map(d => d.tasksCompleted), 1));
        const yTasks = v => baseY - (v / maxTasks) * plotH;
        const yRate  = v => baseY - (v / 100) * plotH;
        const xMid   = i => left + slot * i + slot / 2;

        const tickStep = maxTasks / 4;
        const ticks = [0, 1, 2, 3, 4].map(i => Math.round(i * tickStep * 10) / 10);

        const bars = data.map((d, i) => {
            const y = yTasks(d.tasksCompleted);
            const rate = d.estimateRate == null ? 'no tasks' : `${d.estimateRate}% met estimate`;
            return `<rect class="bar" x="${xMid(i) - barW / 2}" y="${y}" width="${barW}" height="${baseY - y}">
                <title>${d.label}: ${d.tasksCompleted} tasks, ${rate}</title></rect>`;
        }).join('');

        const ratePoints = data.map((d, i) => d.estimateRate == null ? null : { x: xMid(i), y: yRate(d.estimateRate) });
        const ratePath = ratePoints.reduce((path, p, i) => {
            if (!p) return path;
            const move = i === 0 || !ratePoints[i - 1];
            return `${path}${move ? ' M' : ' L'} ${p.x},${p.y}`;
        }, '').trim();

        const goalLine = this.#goal > 0 ? `
            <line class="goal-line" x1="${left}" y1="${yTasks(this.#goal)}" x2="${w - right}" y2="${yTasks(this.#goal)}" />` : '';

        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                svg { width: 100%; height: auto; display: block; }
                .axis { stroke: var(--color-chart-axis-line); stroke-width: 1; }
                .grid-line { stroke: var(--color-chart-grid-line); stroke-width: 1; stroke-dasharray: 4,4; }
                .tick-label, .month-label { font-size: 11px; fill: var(--color-chart-tick-label); }
                .month-label { text-anchor: middle; }
                .left { text-anchor: end; }
                .right { text-anchor: start; }
                .bar { fill: var(--color-chart-primary); opacity: 0.75; }
                .bar:hover { opacity: 1; }
                .goal-line { stroke: var(--color-chart-goal); stroke-width: 1.5; stroke-dasharray: 6,3; }
                .rate-line { fill: none; stroke: var(--color-chart-secondary, #3ecf8e); stroke-width: 2; stroke-linejoin: round; }
                .rate-point { fill: var(--color-chart-secondary, #3ecf8e); }
                .legend { font-size: 11px; fill: var(--color-chart-tick-label); }
                .swatch-bar { fill: var(--color-chart-primary); opacity: 0.75; }
                .swatch-rate { stroke: var(--color-chart-secondary, #3ecf8e); stroke-width: 2; }
                .swatch-goal { stroke: var(--color-chart-goal); stroke-width: 1.5; stroke-dasharray: 6,3; }
            </style>
            <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Tasks completed and estimates met per month">
                ${ticks.map(v => `
                    <line class="grid-line" x1="${left}" y1="${yTasks(v)}" x2="${w - right}" y2="${yTasks(v)}" />
                    <text class="tick-label left" x="${left - 6}" y="${yTasks(v) + 4}">${v}</text>
                    <text class="tick-label right" x="${w - right + 6}" y="${yTasks(v) + 4}">${v / maxTasks * 100 | 0}%</text>
                `).join('')}
                ${bars}
                ${goalLine}
                <path class="rate-line" d="${ratePath}" />
                ${ratePoints.filter(Boolean).map(p => `<circle class="rate-point" cx="${p.x}" cy="${p.y}" r="3" />`).join('')}
                <line class="axis" x1="${left}" y1="${baseY}" x2="${w - right}" y2="${baseY}" />
                ${data.map((d, i) => `<text class="month-label" x="${xMid(i)}" y="${baseY + 16}">${d.label}</text>`).join('')}
                <g transform="translate(${left}, ${h - 4})">
                    <rect class="swatch-bar" x="0" y="-8" width="10" height="8" />
                    <text class="legend" x="14" y="0">Tasks</text>
                    <line class="swatch-goal" x1="56" y1="-4" x2="72" y2="-4" />
                    <text class="legend" x="76" y="0">Goal</text>
                    <line class="swatch-rate" x1="114" y1="-4" x2="130" y2="-4" />
                    <text class="legend" x="134" y="0">% estimates met</text>
                </g>
            </svg>`;
    }
}

// Round up to a value divisible into 4 tidy ticks
function niceMax(v) {
    const raw = v / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= raw);
    return step * 4;
}

customElements.define('trend-chart', TrendChart);
