import percentOf from "./percentOf.js"
export default function getNetIncome(duration, rate, tax) {
    return duration * rate - percentOf(tax, rate)
}

