import { Component, html } from '../../../src/index.js';

const ENTER_KEY = 13;
const ESCAPE_KEY = 27;

export default class TodoItem extends Component(HTMLLIElement) {
  static tag = 'todo-item';

  constructor() {
    super();
    this.editing = false;
  }

  get completed() { return this.model['v-s:completed']?.[0] || false; }
  get title() { return this.model['v-s:title']?.[0] || ''; }

  async connectedCallback() {
    await super.connectedCallback();
    this.updateClass();
  }

  updateClass() {
    if (this.completed) this.classList.add('completed'); else this.classList.remove('completed');
    if (this.editing) this.classList.add('editing'); else this.classList.remove('editing');
    const input = this.querySelector('.toggle');
    if (input) input.checked = !!this.completed;
  }

  handleToggle() {
    this.dispatchEvent(new CustomEvent('toggle-todo', { detail: { id: this.model.id }, bubbles: true }));
  }

  handleDestroy() {
    this.dispatchEvent(new CustomEvent('destroy-todo', { detail: { id: this.model.id }, bubbles: true }));
  }

  async handleEdit(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.editing = true;
    await this.update();
    await this.rendered;
    this.updateClass();
    const input = this.querySelector('.edit');
    if (input) { input.focus(); const l = input.value.length; input.setSelectionRange(l, l); }
  }

  async handleEditKeyDown(event, node) {
    if (event.keyCode === ESCAPE_KEY) {
      this.editing = false;
      await this.update();
      await this.rendered;
      this.updateClass();
    } else if (event.keyCode === ENTER_KEY) {
      this.handleEditSubmit(event, node);
    }
  }

  handleEditBlur(event, node) {
    if (this.editing) this.handleEditSubmit(event, node);
  }

  async handleEditSubmit(event, node) {
    const title = node.value.trim();
    this.dispatchEvent(new CustomEvent('save-todo', { detail: { id: this.model.id, title }, bubbles: true }));
    this.editing = false;
    await this.update();
    await this.rendered;
    this.updateClass();
  }

  render() {
    return html`
      <div class="view">
        <input class="toggle" type="checkbox" name="todo-completed" aria-label="Toggle todo completed" id="toggle-${this.model?.id || ''}" checked="${this.completed ? 'checked' : ''}" onchange="{{handleToggle}}" />
        <label ondblclick="{{handleEdit}}">${this.title}</label>
        <button class="destroy" aria-label="Delete todo" onclick="{{handleDestroy}}"></button>
      </div>
      <input class="edit" name="edit-todo" aria-label="Edit todo title" id="edit-${this.model?.id || ''}" value="${this.title}" onkeydown="{{handleEditKeyDown}}" onblur="{{handleEditBlur}}" />
      <label for="edit-${this.model?.id || ''}" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">Edit todo title</label>
    `;
  }
}

customElements.define(TodoItem.tag, TodoItem, { extends: 'li' });



