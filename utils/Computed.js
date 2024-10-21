//SEE: https://plainvanillaweb.com/blog/articles/2024-08-30-poor-mans-signals/
import { Signal } from "./Signal.js"
class Computed extends Signal {
    constructor(fn, dependencies) {
        super(fn( ...dependencies));
        for (const dependency of dependencies) {
            if (dependency instanceof Signal) {
                dependency.addEventListener('change', () => this.value = fn(...dependencies));
            }
        }
    }
}

export default function computed (fn, ...dependencies) {
    return new Computed(fn,...dependencies);
}