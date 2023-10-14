export default function apply(fn, ...args) {
    return fn.bind(null, ...args)
}