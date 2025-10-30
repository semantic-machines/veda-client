import { Component, html } from '../../../src/index.js';

export default class TodoFooter extends Component(HTMLElement) {
  static tag = 'todo-footer';

  static get observedAttributes() {
    return ['active-count', 'completed-count', 'filter'];
  }

  constructor() {
    super();
    // Reactive state for props
    this.state = this.reactive({
      activeCount: 0,
      completedCount: 0,
      filter: 'all'
    });
  }

  // Computed properties for reactive attributes
  get filterAllClass() { return this.state.filter === 'all' ? 'selected' : ''; }
  get filterActiveClass() { return this.state.filter === 'active' ? 'selected' : ''; }
  get filterCompletedClass() { return this.state.filter === 'completed' ? 'selected' : ''; }
  get hideClearButton() { return this.state.completedCount === 0; }

  async connectedCallback() {
    await super.connectedCallback();
    this.#syncStateFromAttributes();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.isConnected) {
      this.#syncStateFromAttributes();
    }
  }

  #syncStateFromAttributes() {
    this.state.activeCount = Number(this.getAttribute('active-count') || 0);
    this.state.completedCount = Number(this.getAttribute('completed-count') || 0);
    this.state.filter = this.getAttribute('filter') || 'all';
  }

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
