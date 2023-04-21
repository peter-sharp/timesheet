/**
 * dispatches updateState event with given type from given element
 * @param {HTMLElement} el 
 * @param {String} type 
 * @param {Object} detail data to send
 */
export default function emitEvent(el, type, detail = {}) {
    detail = {...detail, type}
    const event = new CustomEvent("updateState", { detail,  bubbles: true });
    el.dispatchEvent(event);
}