export default function reduce(fn, acc, xs) {
    for(let x of xs) {
        acc = fn(acc, x)
    }
    return acc;
}