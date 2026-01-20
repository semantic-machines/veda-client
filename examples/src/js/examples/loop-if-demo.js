import Component, { html } from '../../../../src/components/Component.js';
import { Loop } from '../../../../src/components/LoopComponent.js';
import { If } from '../../../../src/components/IfComponent.js';

class LoopIfDemo extends Component(HTMLElement) {
  static tag = 'loop-if-demo';

  constructor() {
    super();
    this.state.items = [
      { id: 1, text: 'Learn Veda', done: true },
      { id: 2, text: 'Build something cool', done: false },
      { id: 3, text: 'Share with others', done: false },
    ];
    this.state.newItem = '';
    this.state.filter = 'all'; // all, active, completed
    this.state.nextId = 4;
  }

  get filteredItems() {
    switch (this.state.filter) {
      case 'active': return this.state.items.filter(i => !i.done);
      case 'completed': return this.state.items.filter(i => i.done);
      default: return this.state.items;
    }
  }

  get activeCount() {
    return this.state.items.filter(i => !i.done).length;
  }

  get isEmpty() {
    return this.filteredItems.length === 0;
  }

  get allBtnStyle() {
    return this.state.filter === 'all' ? 'background: #e3f2fd' : 'background: #fff';
  }

  get activeBtnStyle() {
    return this.state.filter === 'active' ? 'background: #e3f2fd' : 'background: #fff';
  }

  get completedBtnStyle() {
    return this.state.filter === 'completed' ? 'background: #e3f2fd' : 'background: #fff';
  }

  updateNewItem(e) {
    this.state.newItem = e.target.value;
  }

  addItem(e) {
    e.preventDefault();
    if (!this.state.newItem.trim()) return;

    this.state.items = [...this.state.items, {
      id: this.state.nextId++,
      text: this.state.newItem.trim(),
      done: false
    }];
    this.state.newItem = '';
  }

  handleToggle(e) {
    const id = parseInt(e.target.dataset.id);
    this.state.items = this.state.items.map(item =>
      item.id === id ? { ...item, done: !item.done } : item
    );
  }

  handleRemove(e) {
    const id = parseInt(e.target.dataset.id);
    this.state.items = this.state.items.filter(item => item.id !== id);
  }

  filterAll() {
    this.state.filter = 'all';
  }

  filterActive() {
    this.state.filter = 'active';
  }

  filterCompleted() {
    this.state.filter = 'completed';
  }

  render() {
    return html`
      <div class="card">
        <h2>Todo List with Loop & If</h2>

        <form onsubmit="{addItem}" style="display: flex; gap: 10px; margin-bottom: 20px;">
          <input
            placeholder="What needs to be done?"
            value="{this.state.newItem}"
            oninput="{updateNewItem}"
            style="flex: 1;"
          />
          <button type="submit">Add</button>
        </form>

        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
          <button onclick="{filterAll}" style="{this.allBtnStyle}">All</button>
          <button onclick="{filterActive}" style="{this.activeBtnStyle}">Active ({this.activeCount})</button>
          <button onclick="{filterCompleted}" style="{this.completedBtnStyle}">Completed</button>
        </div>

        <${If} condition="{this.isEmpty}">
          <p style="color: #999; text-align: center; padding: 20px;">No items to show</p>
        </${If}>

        <${Loop} items="{this.filteredItems}" key="id" as="item">
          <todo-item-row :item="{item}"></todo-item-row>
        </${Loop}>
      </div>
    `;
  }
}

// Separate component for todo item to handle item-specific logic
class TodoItemRow extends Component(HTMLElement) {
  static tag = 'todo-item-row';

  get item() {
    return this.state.item;
  }

  get textStyle() {
    return this.item?.done
      ? 'flex: 1; text-decoration: line-through; color: #999'
      : 'flex: 1; text-decoration: none; color: #333';
  }

  get isDone() {
    return this.item?.done || false;
  }

  get itemText() {
    return this.item?.text || '';
  }

  handleToggle() {
    // Bubble up to parent
    const parent = this.closest('loop-if-demo');
    if (parent && this.item) {
      parent.state.items = parent.state.items.map(i =>
        i.id === this.item.id ? { ...i, done: !i.done } : i
      );
    }
  }

  handleRemove() {
    const parent = this.closest('loop-if-demo');
    if (parent && this.item) {
      parent.state.items = parent.state.items.filter(i => i.id !== this.item.id);
    }
  }

  render() {
    return html`
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #eee;">
        <input
          type="checkbox"
          checked="{this.isDone}"
          onchange="{handleToggle}"
        />
        <span style="{this.textStyle}">
          {this.itemText}
        </span>
        <button onclick="{handleRemove}" style="color: #f44336; border-color: #f44336;">×</button>
      </div>
    `;
  }
}

customElements.define(LoopIfDemo.tag, LoopIfDemo);
customElements.define(TodoItemRow.tag, TodoItemRow);
