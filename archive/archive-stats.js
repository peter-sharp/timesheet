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
        <div>
            <dt>Month</dt>
            <dd><output name="totalDurationMonth"></output></dd>
            <dd><output name="totalNetIncomeMonth"></output></dd>
        </div>
        <div>
            <dt>Last Month</dt>
            <dd><output name="totalDurationLastMonth"></output></dd>
            <dd><output name="totalNetIncomeLastMonth"></output></dd>
        </div>
    </dl>
</div>`

class ArchiveStats extends HTMLElement {
    constructor() {
        super();
        this.append(template.content.cloneNode(true));
    }

    update(state) {
        this.render(state);
    }

    render(state) {
        const { totalDurationWeek, totalNetIncomeWeek, totalDurationLastWeek, totalNetIncomeLastWeek, totalDurationMonth, totalNetIncomeMonth, totalDurationLastMonth, totalNetIncomeLastMonth } = state?.stats;
        this.querySelector('[name="totalDurationWeek"]').value = totalDurationWeek;
        this.querySelector('[name="totalNetIncomeWeek"]').value = totalNetIncomeWeek;
        this.querySelector('[name="totalDurationLastWeek"]').value = totalDurationLastWeek;
        this.querySelector('[name="totalNetIncomeLastWeek"]').value = totalNetIncomeLastWeek;
        this.querySelector('[name="totalDurationMonth"]').value = totalDurationMonth;
        this.querySelector('[name="totalNetIncomeMonth"]').value = totalNetIncomeMonth;
        this.querySelector('[name="totalDurationLastMonth"]').value = totalDurationLastMonth;
        this.querySelector('[name="totalNetIncomeLastMonth"]').value = totalNetIncomeLastMonth;
    }
}

window.customElements.define('archive-stats', ArchiveStats);
