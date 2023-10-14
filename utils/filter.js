export default function *filter(fn, xs) {
    for(let x of xs) {
        if(fn(x)) yield x;
    }
}