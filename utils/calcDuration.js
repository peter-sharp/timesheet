export default function calcDuration({ start, end }) {
    return start && end ? formatDurationDecimal(end.getTime() - start.getTime()) : 0
}

export function formatDurationDecimal(duration) {
    const HOUR = 60 * 60 * 1000;
    return toFixedFloat(Math.ceil((duration / HOUR) * 1000) / 1000)
}

export function toFixedFloat(x) {
    return parseFloat(x.toFixed(3))
}