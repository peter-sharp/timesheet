import  "./sync-status.js";
import "./tasksyncstatus-list.js"

export default function sync(el, model) {

    const timesheet = el.querySelector('sync-status');
    model.listen(timesheet.update.bind(timesheet));

    const taskList = el.querySelector('tasksyncstatus-list');
    model.listen(taskList.update.bind(taskList));
}