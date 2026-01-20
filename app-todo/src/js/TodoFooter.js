import { Component, html } from '../../../src/index.js';

/**
 * TodoFooter - demonstrates both approaches:
 * - IMPERATIVE: {this.state.activeCount} for dynamic counts
 */
export default class TodoFooter extends Component(HTMLElement) {
  static tag = 'todo-footer';

  constructor() {
    super();
    // Properties will be set via :prop binding from parent
    this.state.activeCount = 0;
    this.state.completedCount = 0;
    this.state.filter = 'all';
  }

  // Computed properties for reactive class bindings
  get filterAllClass() { return this.state.filter === 'all' ? 'selected' : ''; }
  get filterActiveClass() { return this.state.filter === 'active' ? 'selected' : ''; }
  get filterCompletedClass() { return this.state.filter === 'completed' ? 'selected' : ''; }
  get hideClearButton() { return this.state.completedCount === 0; }
  get itemPlural() { return this.state.activeCount === 1 ? 'item' : 'items'; }

  handleClearCompleted() {
    this.dispatchEvent(new CustomEvent('clear-completed', { bubbles: true }));
  }

  render() {
    return html`
      <footer class="footer">
        <!-- IMPERATIVE: computed expressions for dynamic counts -->
        <span class="todo-count"><strong>{this.state.activeCount}</strong> {this.itemPlural} left</span>
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
