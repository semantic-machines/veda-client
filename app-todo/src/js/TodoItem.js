import { Component, html, reactive } from '../../../src/index.js';

const ENTER_KEY = 13;
const ESCAPE_KEY = 27;

export default class TodoItem extends Component(HTMLLIElement) {
  static tag = 'todo-item';

  constructor() {
    super();
    // Reactive local state - automatically enables reactivity
    this.state = reactive({
      editing: false
    });
  }

  // Computed properties - automatically tracked
  get completed() {
    return this.model?.['v-s:completed']?.[0] || false;
  }

  get title() {
    return this.model?.['v-s:title']?.[0] || '';
  }

  async connectedCallback() {
    await super.connectedCallback();

    // Setup reactive class bindings - run immediately
    this.watch(() => this.completed, (completed) => {
      this.classList.toggle('completed', completed);
    }, { immediate: true });

    this.watch(() => this.state.editing, (editing) => {
      this.classList.toggle('editing', editing);

      // Also update input display
      const input = this.querySelector('.edit');
      if (input) {
        input.style.display = editing ? 'block' : 'none';

        if (editing) {
          // Focus on edit input when editing starts
          requestAnimationFrame(() => {
            input.focus();
            const l = input.value.length;
            input.setSelectionRange(l, l);
          });
        }
      }
    }, { immediate: true });
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
    if (event.keyCode === ESCAPE_KEY) {
      // Cancel editing
      this.state.editing = false;
      node.value = this.title; // Reset to original value
    } else if (event.keyCode === ENTER_KEY) {
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
               ${this.completed ? 'checked' : ''}
               onchange="{handleToggle}" />
        <label ondblclick="{handleEdit}">${this.title}</label>
        <button class="destroy"
                aria-label="Delete todo"
                onclick="{handleDestroy}"></button>
      </div>
      <input class="edit"
             name="edit-todo"
             aria-label="Edit todo title"
             value="${this.title}"
             onkeydown="{handleEditKeyDown}"
             onblur="{handleEditBlur}" />
    `;
  }
}

customElements.define(TodoItem.tag, TodoItem, { extends: 'li' });



