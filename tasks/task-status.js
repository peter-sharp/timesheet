// Small icons used inside the dialog option chips
const STATUS_ICONS = {
    'in-progress': `<svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><polyline points="3,1 13,8 3,15 3,1" style="fill:white;stroke:white;stroke-width:1;stroke-linecap:round;stroke-linejoin:round" /></svg>`,
    'on-hold': `<svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="4" height="12" rx="1" style="fill:white" /><rect x="10" y="2" width="4" height="12" rx="1" style="fill:white" /></svg>`,
    'complete': `<svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><polyline points="1.5 6 4.5 9 10.5 1" style="stroke:white;fill:transparent;stroke-linecap:round;stroke-linejoin:round;stroke-width:2.5" /></svg>`,
    'not-started': '',
};

// Larger icons rendered inside the main status-box
const STATUS_BOX_ICONS = {
    'in-progress': `<svg width="1.2em" height="1.2em" viewBox="0 0 16 16" aria-hidden="true"><polyline points="3,1 13,8 3,15 3,1" style="fill:white;stroke:white;stroke-width:1;stroke-linecap:round;stroke-linejoin:round" /></svg>`,
    'on-hold': `<svg width="1.2em" height="1.2em" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="4" height="12" rx="1" style="fill:white" /><rect x="10" y="2" width="4" height="12" rx="1" style="fill:white" /></svg>`,
    'complete': `<svg class="check-icon" width="1.2em" height="1.2em" viewBox="0 0 16 16" aria-hidden="true"><polyline class="check-stroke" points="1.5 6 4.5 9 10.5 1" style="stroke:white;fill:transparent;stroke-linecap:round;stroke-linejoin:round;stroke-width:2" /></svg>`,
    'not-started': '',
};

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
  position: relative;
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
  overflow: visible;
  transition: all 0.3s ease;
  display: flex;
  cursor: pointer;
  position: relative;
}

.checkbox:not(:last-child) {
  margin-right: 6px;
}

.checkbox:hover {
  background: rgba(0, 119, 255, 0.06);
}

.checkbox span {
  vertical-align: middle;
  transform: translate3d(0, 0, 0);
}

.checkbox span:last-child {
  padding-left: 0.57em;
  line-height: 1.3em;
}

/* Status box replaces the old checkbox span:first-child */
.status-box {
  position: relative;
  flex: 0 0 1.3em;
  width: 1.3em;
  height: 1.3em;
  border-radius: 4px;
  border: 1px solid #cccfdb;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox:hover .status-box {
  border-color: var(--color-success);
}

.status-box[data-status="complete"] {
  background: var(--color-success);
  border-color: var(--color-success);
  animation: zoom-in-out 0.3s ease;
}

.status-box[data-status="in-progress"] {
  background: hsl(210deg, 80%, 45%);
  border-color: hsl(210deg, 80%, 45%);
}

.status-box[data-status="on-hold"] {
  background: hsl(35deg, 90%, 55%);
  border-color: hsl(35deg, 90%, 55%);
}

/* Status dialog */
.status-dialog {
  position: absolute;
  left: 100%;
  top: 0;
  z-index: 200;
  background: var(--color-popup-bg, #fff);
  color: var(--color-popup-text, #123);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  padding: 0.4em;
  display: flex;
  flex-direction: column;
  gap: 0.15em;
  min-width: 10em;
}

.status-dialog[hidden] {
  display: none;
}

.status-option {
  display: flex;
  align-items: center;
  gap: 0.6em;
  padding: 0.4em 0.6em;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--color-popup-text, #123);
  cursor: pointer;
  text-align: left;
  font-size: 0.8em;
  width: 100%;
}

.status-option:hover {
  background: rgba(0,0,0,0.08);
}

.status-option[data-active="true"] {
  background: rgba(0,0,0,0.12);
}

.status-option-icon {
  width: 1.2em;
  height: 1.2em;
  border-radius: 3px;
  border: 1px solid #cccfdb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-option-icon[data-status="complete"] {
  background: var(--color-success);
  border-color: var(--color-success);
}

.status-option-icon[data-status="in-progress"] {
  background: hsl(210deg, 80%, 45%);
  border-color: hsl(210deg, 80%, 45%);
}

.status-option-icon[data-status="on-hold"] {
  background: hsl(35deg, 90%, 55%);
  border-color: hsl(35deg, 90%, 55%);
}

@keyframes zoom-in-out {
  50% {
    transform: scale(0.9);
  }
}

.check-stroke {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
}

.status-box[data-status="complete"] .check-stroke {
  animation: stroke-animation 0.3s ease forwards;
}

@keyframes stroke-animation {
  to {
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
    <span class="status-box" data-status="not-started"></span>
    <span class="sr-only">Status</span>
    </label>
    <div class="status-dialog" hidden role="menu" aria-label="Set task status">
        <button class="status-option" data-status="not-started" role="menuitem">
            <span class="status-option-icon" data-status="not-started"></span>
            <span>Not started</span>
        </button>
        <button class="status-option" data-status="in-progress" role="menuitem">
            <span class="status-option-icon" data-status="in-progress">${STATUS_ICONS['in-progress']}</span>
            <span>In progress</span>
        </button>
        <button class="status-option" data-status="on-hold" role="menuitem">
            <span class="status-option-icon" data-status="on-hold">${STATUS_ICONS['on-hold']}</span>
            <span>On hold</span>
        </button>
        <button class="status-option" data-status="complete" role="menuitem">
            <span class="status-option-icon" data-status="complete">${STATUS_ICONS['complete']}</span>
            <span>Complete</span>
        </button>
    </div>
</div>`


class TaskStatus extends HTMLElement {
    static observedAttributes = ["checked", "status"];

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: "open" });
        shadow.append(template.content.cloneNode(true));
    }

    state = {
        checked: false,
        status: "not-started",
        id: null
    }

    connectedCallback() {
        this.checkBox = this.querySelector("input");
        this.replacementCheckbox = this.shadowRoot.querySelector("input");
        this.statusDialog = this.shadowRoot.querySelector(".status-dialog");
        this.statusBox = this.shadowRoot.querySelector(".status-box");
        this.label = this.shadowRoot.querySelector("label");

        this.state.id = this.id || Date.now();
        this.replacementCheckbox.disabled = this.checkBox.disabled;

        // Click: toggle between not-started and complete
        this.updateCheckbox = () => {
            const { checked } = this.replacementCheckbox;
            const status = checked ? "complete" : "not-started";
            this.update({ checked, status });
            const ev = new Event("change", { bubbles: true });
            this.checkBox.dispatchEvent(ev);
        };
        this.replacementCheckbox.addEventListener("change", this.updateCheckbox);

        // Initialize from native checkbox
        const { checked } = this.checkBox;
        const statusAttr = this.getAttribute("status");
        const initStatus = statusAttr || (checked ? "complete" : "not-started");
        this.update({ checked: initStatus === "complete", status: initStatus });

        // Long press detection
        let longPressTimer = null;
        let isLongPress = false;

        this.label.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                this.showDialog();
            }, 500);
        });

        this.label.addEventListener("pointerup", () => clearTimeout(longPressTimer));
        this.label.addEventListener("pointercancel", () => clearTimeout(longPressTimer));
        this.label.addEventListener("pointerleave", () => clearTimeout(longPressTimer));

        // Prevent checkbox toggle when long press triggered the dialog
        this.label.addEventListener("click", (e) => {
            if (isLongPress) {
                e.preventDefault();
                isLongPress = false;
            }
        });

        // Right-click to show dialog
        this.label.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.showDialog();
        });

        // Dialog option clicks
        const statusOptions = this.statusDialog.querySelectorAll(".status-option");
        statusOptions.forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const status = btn.dataset.status;
                const checked = status === "complete";
                this.update({ status, checked });
                this.hideDialog();

                // Sync native checkbox state without firing change (taskStatusChange covers it)
                this.checkBox.checked = checked;

                // Dispatch status-specific event
                this.dispatchEvent(new CustomEvent("taskStatusChange", {
                    bubbles: true,
                    composed: true,
                    detail: { status },
                }));
            });
        });

        // Click-outside handler
        this._clickOutsideHandler = (e) => {
            if (!this.contains(e.target) && !this.shadowRoot.contains(e.composedPath()[0])) {
                this.hideDialog();
            }
        };
    }

    disconnectedCallback() {
        this.replacementCheckbox.removeEventListener("change", this.updateCheckbox);
        document.removeEventListener("click", this._clickOutsideHandler);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "checked") {
            const checked = newValue !== null && newValue !== "false";
            this.update({ checked, status: checked ? "complete" : "not-started" });
        }
        if (name === "status") {
            const status = newValue || "not-started";
            this.update({ status, checked: status === "complete" });
        }
    }

    set checked(value) {
        const checked = Boolean(value);
        this.update({ checked, status: checked ? "complete" : "not-started" });
    }

    set status(value) {
        const status = value || "not-started";
        this.update({ status, checked: status === "complete" });
    }

    showDialog() {
        if (!this.statusDialog) return;
        // Mark active option
        this.statusDialog.querySelectorAll(".status-option").forEach((btn) => {
            btn.dataset.active = btn.dataset.status === this.state.status ? "true" : "false";
        });
        this.statusDialog.hidden = false;
        // Add outside-click listener after a tick to avoid immediately closing
        setTimeout(() => {
            document.addEventListener("click", this._clickOutsideHandler);
        }, 0);
    }

    hideDialog() {
        if (!this.statusDialog) return;
        this.statusDialog.hidden = true;
        document.removeEventListener("click", this._clickOutsideHandler);
    }

    update(state) {
        this.state = { ...this.state, ...state };
        this.render(this.state);
    }

    render({ checked, status, id }) {
        if (this.checkBox) {
            this.checkBox.checked = checked;
        }
        if (this.replacementCheckbox) {
            this.replacementCheckbox.checked = checked;
            this.replacementCheckbox.setAttribute("id", id);
            this.label.setAttribute("for", id);
        }
        if (this.statusBox) {
            this.statusBox.dataset.status = status || "not-started";
            this.statusBox.innerHTML = STATUS_BOX_ICONS[status] || "";
        }
    }
}

window.customElements.define('task-status', TaskStatus);
