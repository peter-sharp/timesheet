import "./timesheet-archive.js"
import round1dp from "../utils/round1dp.js";
import formatPrice from "../utils/formatPrice.js";

export default function archive(el, model) {
    const elArchiveForm = el.querySelector('form[name="archive"]')

    // TODO find out if still needed:
    // const elDetails = el;
    // elDetails.addEventListener('toggle', function updateArchiveActiveState(){
    //     model.emit({
    //         type: 'archiveState',
    //         state: elDetails.open
    //     })
    // })

    elArchiveForm.addEventListener('submit', function archive(ev) {
        ev.preventDefault();
        if (ev.submitter ?.name == 'archive') {
            model.emit({
                type: 'archive'
            })
        }
    });

    model.listen(function renderStats({ stats = {} }) {
        const { 
            totalDurationWeek = 0, 
            totalNetIncomeWeek = 0,
            totalDurationLastWeek = 0,
            totalNetIncomeLastWeek = 0,
            totalDurationMonth = 0, 
            totalNetIncomeMonth = 0,
            totalDurationLastMonth = 0, 
            totalNetIncomeLastMonth = 0
        } = stats;
        el.querySelector('[name="totalDurationWeek"]').value = round1dp(totalDurationWeek);
        el.querySelector('[name="totalNetIncomeWeek"]').value = formatPrice(totalNetIncomeWeek);
        el.querySelector('[name="totalDurationLastWeek"]').value = round1dp(totalDurationLastWeek);
        el.querySelector('[name="totalNetIncomeLastWeek"]').value = formatPrice(totalNetIncomeLastWeek);
        el.querySelector('[name="totalDurationMonth"]').value = round1dp(totalDurationMonth);
        el.querySelector('[name="totalNetIncomeMonth"]').value = formatPrice(totalNetIncomeMonth);
        el.querySelector('[name="totalDurationLastMonth"]').value = round1dp(totalDurationLastMonth);
        el.querySelector('[name="totalNetIncomeLastMonth"]').value = formatPrice(totalNetIncomeLastMonth);
    });

    const timesheetArchive = el.querySelector('timesheet-archive');
    model.listen(timesheetArchive.update.bind(timesheetArchive));
    
    const tasksList = el.querySelector('task-list');
    model.listen(({ archivedTasks }) => tasksList.update({ tasks: archivedTasks }));
}