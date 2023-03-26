export function allInputsEntered(el) {
    let entered = true;
    for (const input of el.querySelectorAll('input')) {
        if (!input.value) {
            entered = false;
            break;
        }
    }
    return entered;
}

export function noInputsEntered(el) {
    let none = true;
    for (const input of el.querySelectorAll('input')) {
        if (input.value) {
            none = false;
            break;
        }
    }
    return none;
}

export function allInputsEnteredExcept(except, el) {
    let entered = true;
    for (const input of el.querySelectorAll('input')) {
        if (!except.includes(input.name) && !input.value) {
            entered = false;
            break;
        }
    }
    return entered;
}