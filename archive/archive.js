import "./timesheet-archive.js"
import "./task-archive.js"
import round1dp from "../utils/round1dp.js";
import formatPrice from "../utils/formatPrice.js";
import subWeek from "../utils/subWeek.js";
import subMonth from "../utils/subMonth.js";
import isSameWeek from "../utils/isSameWeek.js";
import reduce from "../utils/reduce.js";
import percentOf from "../utils/percentOf.js";
import shallowClone from "../utils/shallowClone.js";
import reduceDuration from "../utils/reduceDuration.js";
import filter from "../utils/filter.js";
import apply from "../utils/apply.js";

export default function archive(el, model) {
    model.use([
        function archiveEntries(state, ev) {
            switch (ev.type) {
                case 'archive':
                    state.archive = [...state.entries.map(shallowClone), ...state.archive];
                    state.archive.sort(function byStartTimeDesc(a,b){
                        if(a.start > b.start) return -1;
                        if(a.start < b.start) return 1;
                        return 0;
                    });

                    const tasksToArchive = [...state.tasks, ...(state.archivedTasks || [])]
                  
                    tasksToArchive.sort(function byMostRecentEntryAsc(a,b){
                        if(a.mostRecentEntry < b.mostRecentEntry) return -1;
                        if(a.mostRecentEntry > b.mostRecentEntry) return 1;
                        return 0;
                    });
                    let archivedTasks = {};
                    for (const task of tasksToArchive) {
                        if(!(task.exid in archivedTasks)) {
                            archivedTasks[task.exid] = { history: []};
                        }
                        const {history, ...taskMinusHistory} = task
                        archivedTasks[task.exid] = {...taskMinusHistory, history: [{...taskMinusHistory}, ...archivedTasks[task.exid].history]}
                    }
                    archivedTasks = Object.values(archivedTasks)
                    archivedTasks.sort(function byMostRecentEntryDesc(a,b){
                        if(new Date(a.mostRecentEntry) > new Date(b.mostRecentEntry)) return -1;
                        if(new Date(a.mostRecentEntry) < new Date(b.mostRecentEntry)) return 1;
                        return 0;
                    });
                    state.archivedTasks = archivedTasks;
                    console.log('Archived Tasks', state.archivedTasks)
                    state.tasks = [];
                    state.entries = [];
                    break;
            
                case 'archiveState':
                    state.archiveOpen = ev.state;
                    break;
                case 'updateArchivePage':
                    state.archiveBrowserPage = ev.page
                    break;
                case 'updateArchiveTaskPage':
                    state.archiveBrowserTaskPage = ev.page
                    break;
                case 'deleteArchiveEntry':
                    const archive = [];
                    state.deleted = state.deleted || [];
                    for (const x of state.archive) {
                        if(x.id == ev.id) state.deleted.push(x)
                        else archive.push(x)
                    }
                    state.archive = archive
                    break;
            }
            
            return state;
        },
        function archiveTotals(state, ev) {
            if(!ev.type.toLowerCase().includes('archive')) return state;
            const now = new Date()
            const lastMonth = subMonth(now, 1);
            const lastWeek = subWeek(now, 1);

            const isCurrentWeek = (x) => isSameWeek(now, x.start);
            const isLastWeek = (x) => isSameWeek(lastWeek, x.start);

            function isSameMonth(date, x) {
                return x.start.getMonth() == date.getMonth()
            }

            const totalDurationWeek = reduce(reduceDuration, 0, filter(isCurrentWeek, state.archive))
            const totalNetIncomeWeek = totalDurationWeek * (state.settings.rate || 0) - percentOf(state.settings.tax || 0, state.settings.rate || 0)

            const totalDurationLastWeek = reduce(reduceDuration, 0, filter(isLastWeek, state.archive))
            const totalNetIncomeLastWeek = totalDurationLastWeek * (state.settings.rate || 0) - percentOf(state.settings.tax || 0, state.settings.rate || 0)

            const totalDurationMonth = reduce(reduceDuration, 0, filter(apply(isSameMonth, now), state.archive))
            const totalNetIncomeMonth = totalDurationMonth * (state.settings.rate || 0) - percentOf(state.settings.tax || 0, state.settings.rate || 0)
            const totalDurationLastMonth = reduce(reduceDuration, 0, filter(apply(isSameMonth, lastMonth), state.archive))
            const totalNetIncomeLastMonth = totalDurationLastMonth * (state.settings.rate || 0) - percentOf(state.settings.tax || 0, state.settings.rate || 0)
            state.stats = {
                ...state.stats,
                totalDurationWeek,
                totalNetIncomeWeek,
                totalDurationLastWeek,
                totalNetIncomeLastWeek,
                totalDurationMonth,
                totalNetIncomeMonth,
                totalDurationLastMonth,
                totalNetIncomeLastMonth
            };
            console.log(state.stats)
            return state;
        },], )
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

    const taskArchive = el.querySelector('task-archive');
    model.listen(taskArchive.update.bind(taskArchive));
    
   
}