import calcDuration from "./calcDuration.js";
export default  function reduceDuration(acc, x) {
    return acc + calcDuration(x);
}