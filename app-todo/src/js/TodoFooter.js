import { Component, html } from '../../../src/index.js';

export default class TodoFooter extends Component(HTMLElement) {
  static tag = 'todo-footer';

  constructor() {
    super();
    // State is auto-created
    // Properties will be set via :prop syntax from parent
    this.state.activeCount = 0;
    this.state.completedCount = 0;
    this.state.filter = 'all';
  }

  // Computed properties for reactive attributes
  get filterAllClass() { return this.state.filter === 'all' ? 'selected' : ''; }
  get filterActiveClass() { return this.state.filter === 'active' ? 'selected' : ''; }
  get filterCompletedClass() { return this.state.filter === 'completed' ? 'selected' : ''; }
  get hideClearButton() { return this.state.completedCount === 0; }

  handleClearCompleted() {
    this.dispatchEvent(new CustomEvent('clear-completed', { bubbles: true }));
  }

  render() {
    return html`
      <footer class="footer">
        <span class="todo-count"><strong>{this.state.activeCount}</strong> {this.state.activeCount === 1 ? 'item' : 'items'} left</span>
        <ul class="filters">
          <li><a class="{this.filterAllClass}" href="#/">All</a></li>
          <li><a class="{this.filterActiveClass}" href="#/active">Active</a></li>
          <li><a class="{this.filterCompletedClass}" href="#/completed">Completed</a></li>
        </ul>
        <button class="clear-completed" onclick="{handleClearCompleted}" hidden="{this.hideClearButton}">Clear completed</button>
      </footer>
    `;
  }
}

customElements.define(TodoFooter.tag, TodoFooter);
