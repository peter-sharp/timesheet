export default function timeToDate(val) {
    const date = new Date();
    const [hours, mins] = val.split(':')
    date.setHours(hours);
    date.setMinutes(mins);
    return date;
}
