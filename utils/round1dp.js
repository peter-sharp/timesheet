export default function round1dp(x) {
    const rounded = Math.round(x * 10) / 10
    return rounded - Math.floor(rounded) >= 0.1 ? rounded : Math.floor(rounded)
}