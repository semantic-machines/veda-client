import { Component, html } from '../../../src/index.js';

export default class TodoFooter extends Component(HTMLElement) {
  static tag = 'todo-footer';

  get activeCount() { return Number(this.getAttribute('active-count') || 0); }
  get completedCount() { return Number(this.getAttribute('completed-count') || 0); }
  get filter() { return this.getAttribute('filter') || 'all'; }

  handleClearCompleted() {
    this.dispatchEvent(new CustomEvent('clear-completed', { bubbles: true }));
  }

  render() {
    return html`
      <footer class="footer">
        <span class="todo-count"><strong>${this.activeCount}</strong> ${this.activeCount === 1 ? 'item' : 'items'} left</span>
        <ul class="filters">
          <li><a class="${this.filter === 'all' ? 'selected' : ''}" href="#/">All</a></li>
          <li><a class="${this.filter === 'active' ? 'selected' : ''}" href="#/active">Active</a></li>
          <li><a class="${this.filter === 'completed' ? 'selected' : ''}" href="#/completed">Completed</a></li>
        </ul>
        ${this.completedCount > 0 ? html`<button class="clear-completed" onclick="{{handleClearCompleted}}">Clear completed</button>` : ''}
      </footer>
    `;
  }
}

customElements.define(TodoFooter.tag, TodoFooter);



