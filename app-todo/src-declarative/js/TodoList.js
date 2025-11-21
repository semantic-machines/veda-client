import { Component, html } from '../../../src/index.js';
import TodoItem from './TodoItem.js';

/**
 * TodoList component - filters todos based on filter attribute
 * Each instance represents one todo from the rel component
 */
export default class TodoList extends Component(HTMLLIElement) {
  static tag = 'todo-list';

  get filter() {
    return this.getAttribute('filter') || 'all';
  }

  get shouldDisplay() {
    const completed = !!this.state.model?.['v-s:completed']?.[0];

    if (this.filter === 'active') return !completed;
    if (this.filter === 'completed') return completed;
    return true; // 'all'
  }

  render() {
    // If this todo doesn't match filter, don't render anything
    if (!this.shouldDisplay) {
      return html``;
    }

    // Render TodoItem with current model
    return html`<${TodoItem}></${TodoItem}>`;
  }
}

customElements.define(TodoList.tag, TodoList, { extends: 'li' });

