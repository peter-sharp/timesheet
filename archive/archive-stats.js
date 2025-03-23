import round1dp from "../utils/round1dp.js";
import formatPrice from "../utils/formatPrice.js";

const template = document.createElement('template');
template.innerHTML = /*html*/`
<div>
    <h3 class="h5">Totals</h3>
    <dl>
        <div>
            <dt>Week</dt>
            <dd><output name="totalDurationWeek"></output></dd>
            <dd><output name="totalNetIncomeWeek"></output></dd>
        </div>
        <div>
            <dt>Last Week</dt>
            <dd><output name="totalDurationLastWeek"></output></dd>
            <dd><output name="totalNetIncomeLastWeek"></output></dd>
        </div>
    </dl>
    <div>
        <h3 class="h5">Daily Hours This Month</h3>
        <graph-chart 
            width="600" 
            height="200" 
            padding="40"
            x-label="Day of Month"
            y-label="Hours"
        ></graph-chart>
    </div>
</div>`

class ArchiveStats extends HTMLElement {
    constructor() {
        super();
        this.append(template.content.cloneNode(true));
        this.graphChart = this.querySelector('graph-chart');
    }

    update(state) {
        this.render(state);
    }

    render(state) {
        const {
                totalDurationWeek = 0, 
                totalNetIncomeWeek = 0,
                totalDurationLastWeek = 0,
                totalNetIncomeLastWeek = 0, 
                } = state?.stats;

        const { archive = [] } = state;
        
        this.querySelector('[name="totalDurationWeek"]').value = round1dp(totalDurationWeek);
        this.querySelector('[name="totalNetIncomeWeek"]').value = formatPrice(totalNetIncomeWeek);
        this.querySelector('[name="totalDurationLastWeek"]').value = round1dp(totalDurationLastWeek);
        this.querySelector('[name="totalNetIncomeLastWeek"]').value = formatPrice(totalNetIncomeLastWeek);
  
        // Calculate daily totals for the current month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Create an array of all days in the month
        const daysInMonth = [];
        for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setDate(d.getDate() + 1)) {
            daysInMonth.push(new Date(d));
        }

        // Calculate total hours for each day
        const dailyTotals = daysInMonth.map(date => {
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);

            const dayEntries = archive.filter(entry => {
                const entryStart = new Date(entry.start);
                return entryStart >= dayStart && entryStart <= dayEnd;
            });

            const totalHours = dayEntries.reduce((total, entry) => {
                const duration = (new Date(entry.end) - new Date(entry.start)) / (1000 * 60 * 60);
                return total + duration;
            }, 0);

            return {
                x: date.getDate(),
                y: totalHours
            };
        });

        this.graphChart.data = dailyTotals;
    }
}

window.customElements.define('archive-stats', ArchiveStats);
