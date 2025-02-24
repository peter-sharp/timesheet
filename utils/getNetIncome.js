import percentOf from "./percentOf.js"
export default function getNetIncome(duration, rate, tax) {
    const gross = duration * rate;
    return gross - percentOf(tax, gross);
}

