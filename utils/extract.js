export default function extract(regs, x) {
    let res = [];
    let str = x;
    for (const reg of regs) {
        let [rawItem, item] = str.match(reg) || [];
        str = str.replace(rawItem, '');
        res.push(item);
    }
    res.push(str);
    return res;
}
