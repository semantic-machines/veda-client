import { Component, html } from '../../../src/index.js';

/**
 * TodoHeader - demonstrates declarative property binding for title
 *
 * Uses `property="rdfs:label"` to display list name from model.
 * This is the DECLARATIVE approach - the value is automatically
 * bound to the model property and updates reactively.
 */
export default class TodoHeader extends Component(HTMLElement) {
  static tag = 'todo-header';

  handleNewTodo(event, node) {
    if (event.key !== 'Enter') return;
    const title = node.value.trim();
    if (!title) return;
    this.dispatchEvent(new CustomEvent('new-todo', { detail: { title }, bubbles: true }));
    node.value = '';
  }

  render() {
    return html`
      <header class="header">
        <!-- DECLARATIVE: property component auto-binds to model.rdfs:label -->
        <h1 property="rdfs:label"></h1>
        <input class="new-todo" id="new-todo" name="new-todo" aria-label="Create a new todo" placeholder="What needs to be done?" onkeydown="{handleNewTodo}" />
      </header>
    `;
  }
}

customElements.define(TodoHeader.tag, TodoHeader);
