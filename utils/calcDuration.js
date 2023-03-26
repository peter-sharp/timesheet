export default function calcDuration({ start, end }) {
    return start && end ? formatDurationDecimal(end.getTime() - start.getTime()) : 0
}

function formatDurationDecimal(duration) {
    const HOUR = 60 * 60 * 1000;
    return Math.ceil((duration / HOUR) * 10) / 10
}