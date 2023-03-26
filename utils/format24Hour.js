export default function format24hour(date) {
    return padNumber(2, date.getHours()) + ':' + padNumber(2, date.getMinutes());
}

function padNumber(l, n) { return `${n}`.padStart(l, '0'); }