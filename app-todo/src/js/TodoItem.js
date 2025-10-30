import { Component, html } from '../../../src/index.js';

export default class TodoItem extends Component(HTMLLIElement) {
  static tag = 'todo-item';

  constructor() {
    super();
    // Reactive local state
    this.state = this.reactive({
      editing: false
    });
  }

  // Computed properties
  get completed() {
    return this.model?.['v-s:completed']?.[0] || false;
  }

  get title() {
    return this.model?.['v-s:title']?.[0] || '';
  }

  async connectedCallback() {
    await super.connectedCallback();

    // Separate effect for completed class - only runs when completed changes
    this.effect(() => {
      this.classList.toggle('completed', this.completed);
    });

    // Separate effect for editing class and focus management - only runs when editing changes
    this.effect(() => {
      this.classList.toggle('editing', this.state.editing);

      if (this.state.editing) {
        // Focus input when entering edit mode
        const input = this.querySelector('.edit');
        if (input) {
          requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          });
        }
      }
    });
  }

  handleToggle() {
    this.dispatchEvent(new CustomEvent('toggle-todo', {
      detail: { id: this.model.id },
      bubbles: true
    }));
  }

  handleDestroy() {
    this.dispatchEvent(new CustomEvent('destroy-todo', {
      detail: { id: this.model.id },
      bubbles: true
    }));
  }

  handleEdit(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    // Just update state - reactivity handles the rest
    this.state.editing = true;
  }

  handleEditKeyDown(event, node) {
    if (event.key === 'Escape') {
      // Cancel editing
      this.state.editing = false;
      node.value = this.title; // Reset to original value
    } else if (event.key === 'Enter') {
      this.handleEditSubmit(event, node);
    }
  }

  handleEditBlur(event, node) {
    if (this.state.editing) {
      this.handleEditSubmit(event, node);
    }
  }

  handleEditSubmit(event, node) {
    const title = node.value.trim();
    this.dispatchEvent(new CustomEvent('save-todo', {
      detail: { id: this.model.id, title },
      bubbles: true
    }));
    // Exit editing mode
    this.state.editing = false;
  }

  render() {
    return html`
      <div class="view">
        <input class="toggle" type="checkbox"
               name="todo-completed"
               aria-label="Toggle todo completed"
               id="toggle-${this.model?.id || ''}"
               checked="{this.completed}"
               onchange="{handleToggle}" />
        <label ondblclick="{handleEdit}">{this.title}</label>
        <button class="destroy"
                aria-label="Delete todo"
                onclick="{handleDestroy}"></button>
      </div>
      <input class="edit"
             name="edit-todo"
             aria-label="Edit todo title"
             value="{this.title}"
             onkeydown="{handleEditKeyDown}"
             onblur="{handleEditBlur}" />
    `;
  }
}

customElements.define(TodoItem.tag, TodoItem, { extends: 'li' });
