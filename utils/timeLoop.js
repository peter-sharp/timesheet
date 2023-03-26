export default function timeLoop(ms, fn) {
    fn();
    let that = this === window || this === undefined ? {} : this
    that.timeout = setTimeout(timeLoop.bind(that, ms, fn), ms);
    return that
}