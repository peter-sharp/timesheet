const template = document.createElement("template");
template.innerHTML = /*html*/ 
`<link rel="stylesheet" href="./style.css" />
<style>
    
    .checkbox-symbol {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  user-select: none;
}
.checkbox-container {
    font-size: 1.4rem;
  box-sizing: border-box;
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-flow: row wrap;
}

.checkbox-container * {
  box-sizing: border-box;
}

.checkbox-input {
  position: absolute;
  visibility: hidden;
}

.checkbox {
  
  user-select: none;
  
  padding: 0.42em 0.57em;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.3s ease;
  display: flex;
}

.checkbox-input:not([disabled]) + .checkbox {
  cursor: pointer;
}

.checkbox:not(:last-child) {
  margin-right: 6px;
}

.checkbox-input:not([disabled]) + .checkbox:hover {
  background: rgba(0, 119, 255, 0.06);
}

.checkbox span {
  vertical-align: middle;
  transform: translate3d(0, 0, 0);
}

.checkbox span:first-child {
  position: relative;
  flex: 0 0 1.3em;
  width: 1.3em;
  height: 1.3em;
  border-radius: 4px;
  transform: scale(1);
  border: 1px solid #cccfdb;
  transition: all 0.3s ease;
}

.checkbox span:first-child svg {
  position: absolute;
  top: 0.21em;
  left: 0.21em;
  fill: none;
  stroke: #fff;
  stroke-dasharray: 16px;
  stroke-dashoffset: 16px;
  transition: all 0.3s ease;
  transform: translate3d(0, 0, 0);
}

.checkbox span:last-child {
  padding-left: 0.57em;
  line-height: 1.3em;
}

.checkbox-input[disabled] + .checkbox {
  --color-success: #99999999;
}

.checkbox-input:not([disabled]) + .checkbox:hover span:first-child {
  border-color: var(--color-success);
}

.checkbox-input:checked + .checkbox span:first-child {
  background: var(--color-success);
  border-color: var(--color-success);
  animation: zoom-in-out 0.3s ease;
}

.checkbox-input:checked + .checkbox span:first-child svg {
  stroke-dashoffset: 0;
  animation: stroke-animation 0.3s ease-in 0.1s forwards;
}

@keyframes zoom-in-out {
  50% {
    transform: scale(0.9);
  }
}

@keyframes stroke-animation {
  0% {
    stroke-dashoffset: 16px;
  }
  100% {
    stroke-dashoffset: 0;
  }
}
</style>
<div class="checkbox-container">
    <div class="sr-only">
    <slot>
    </slot>
    </div>
    <input class="checkbox-input" id="" type="checkbox" />
    <label class="checkbox" for="">
    <span>
        <svg width="1.2em" height="1.2em" viewBox="0 0 16 16">
        <polyline 
        points="1.5 6 4.5 9 10.5 1" 
        style="stroke: currentColor; fill: transparent; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2"
        />
        </svg>
    </span>
    <span class="sr-only">Complete</span>
    </label>
</div>`


class TaskStatus extends HTMLElement {
    static observedAttributes = ["checked"];


    constructor() {
        super();
        const shadow = this.attachShadow({ mode: "open" });
        shadow.append(template.content.cloneNode(true));
    }
    state = {
        checked: false,
        state: "todo",
        id: null
    }
    connectedCallback() {
       
        this.checkBox = this.querySelector("input");
        this.replacementCheckbox =  this.shadowRoot.querySelector("input");
        this.state.id = this.id || Date.now()
        this.replacementCheckbox.disabled = this.checkBox.disabled
      
        this.updateCheckbox = () => {
            const {checked} = this.replacementCheckbox
            this.update({checked, state: checked ? "complete" : "todo"}); 
            const ev = new Event("change", {bubbles: true})
            this.checkBox.dispatchEvent(ev)
            
        }
        this.replacementCheckbox.addEventListener("change", this.updateCheckbox);
        const {checked} = this.checkBox
        this.update({checked, state: checked ? "complete" : "todo"}); 
    }

    disconnectedCallback() {
        this.replacementCheckbox.removeEventListener("change", this.updateCheckbox);
    }

    attributeChangedCallback(name, oldValue, newValue) {
       if(name == 'checked') this.update({ checked: newValue !== null && newValue !== "false" });
    }

    set checked(value) {
        this.update({ checked: Boolean(value) });
    }

    update(state) {
        this.state = { ...this.state, ...state};
        this.render(this.state);
    }

    render({ checked, id }) {
        if (this.checkBox) {
            this.checkBox.checked = checked;
        }
        if (this.replacementCheckbox) {
            this.replacementCheckbox.checked = checked;
            this.replacementCheckbox.setAttribute("id", id);
            this.shadowRoot.querySelector("label").setAttribute("for", id);
        }
    }
}

window.customElements.define('task-status', TaskStatus);
