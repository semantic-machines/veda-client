import { Component, html } from '../../../src/index.js';

const ENTER_KEY = 13;

export default class TodoHeader extends Component(HTMLElement) {
  static tag = 'todo-header';

  handleNewTodo(event, node) {
    if (event.keyCode !== ENTER_KEY) return;
    const title = node.value.trim();
    if (!title) return;
    this.dispatchEvent(new CustomEvent('new-todo', { detail: { title }, bubbles: true }));
    node.value = '';
  }

  render() {
    return html`
      <header class="header">
        <h1>todos</h1>
        <input class="new-todo" id="new-todo" name="new-todo" aria-label="Create a new todo" placeholder="What needs to be done?" onkeydown="{{handleNewTodo}}" />
      </header>
    `;
  }
}

customElements.define(TodoHeader.tag, TodoHeader);



