import { isSupported, pickFile, storeHandle, removeHandle, retrieveHandle, verifyPermission } from './fileSync.js';
import { syncInbound } from './syncEngine.js';
import emitEvent from './utils/emitEvent.js';

const template = document.createElement('template');
template.innerHTML = /*html*/ `
<ul class="unstyled-list stack" style="--gap: 0.4em">
  <li data-todo-row>
    <button name="linkTodo">Link todo.txt</button>
    <span data-todo-linked hidden>
      <span data-file-name></span>
      <button name="unlinkTodo">Unlink</button>
    </span>
  </li>
  <li data-done-row>
    <button name="linkDone">Link done.txt</button>
    <span data-done-linked hidden>
      <span data-file-name></span>
      <button name="unlinkDone">Unlink</button>
    </span>
  </li>
</ul>
<p data-unsupported hidden>Not supported in this browser</p>`;

customElements.define('file-sync-menu', class extends HTMLElement {
    connectedCallback() {
        this.appendChild(template.content.cloneNode(true));

        if (typeof window.showOpenFilePicker !== 'function') {
            this.querySelector('[data-unsupported]').hidden = false;
            this.querySelector('ul').hidden = true;
            return;
        }

        this.querySelector('[name="linkTodo"]').addEventListener('click', () => this._link('todoFile', 'todo.txt'));
        this.querySelector('[name="linkDone"]').addEventListener('click', () => this._link('doneFile', 'done.txt'));
        this.querySelector('[name="unlinkTodo"]').addEventListener('click', () => this._unlink('todoFile'));
        this.querySelector('[name="unlinkDone"]').addEventListener('click', () => this._unlink('doneFile'));

        this._refreshStatus();
    }

    async _refreshStatus() {
        await this._updateRow('todoFile', '[data-todo-row]', '[data-todo-linked]', '[name="linkTodo"]');
        await this._updateRow('doneFile', '[data-done-row]', '[data-done-linked]', '[name="linkDone"]');
    }

    async _updateRow(key, rowSel, linkedSel, btnSel) {
        const record = await retrieveHandle(key);
        const linkedEl = this.querySelector(linkedSel);
        const btnEl = this.querySelector(btnSel);

        if (record) {
            linkedEl.hidden = false;
            linkedEl.querySelector('[data-file-name]').textContent = record.fileName || key;
            btnEl.hidden = true;
        } else {
            linkedEl.hidden = true;
            btnEl.hidden = false;
        }
    }

    async _link(key, description) {
        try {
            const handle = await pickFile(description);
            const file = await handle.getFile();
            await storeHandle(key, handle, file.name);
            this._refreshStatus();
        } catch (e) {
            if (e.name !== 'AbortError') console.warn('File link failed:', e);
        }
    }

    async _unlink(key) {
        await removeHandle(key);
        this._refreshStatus();
    }
});
