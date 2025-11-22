import { Component, html } from '../../../src/index.js';

/**
 * TodoItem - hybrid approach
 * Uses property for display, JavaScript for logic
 */
export default class TodoItem extends Component(HTMLLIElement) {
  static tag = 'todo-item-declarative';

  constructor() {
    super();
    this.state.editing = false;
  }

  // Computed properties
  get completed() {
    return this.state.model?.['v-s:completed']?.[0] || false;
  }

  get title() {
    return this.state.model?.['v-s:title']?.[0] || '';
  }

  async connectedCallback() {
    await super.connectedCallback();

    // Effects for class management
    this.effect(() => {
      this.classList.toggle('completed', this.completed);
    });

    this.effect(() => {
      this.classList.toggle('editing', this.state.editing);

      if (this.state.editing) {
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

  async handleToggle() {
    const prev = this.completed;
    this.state.model['v-s:completed'] = [!prev];

    try {
      await this.state.model.save();
    } catch (error) {
      console.error('Failed to toggle todo:', error);
      this.state.model['v-s:completed'] = [prev];
    }
  }

  handleEdit(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    this.state.editing = true;
  }

  handleEditKeyDown(event, node) {
    if (event.key === 'Escape') {
      this.state.editing = false;
      node.value = this.title;
    } else if (event.key === 'Enter') {
      this.handleEditSubmit(event, node);
    }
  }

  handleEditBlur(event, node) {
    if (this.state.editing) {
      this.handleEditSubmit(event, node);
    }
  }

  async handleEditSubmit(event, node) {
    const title = node.value.trim();

    if (!title) {
      await this.handleDestroy();
      return;
    }

    const prev = this.title;
    this.state.model['v-s:title'] = [title];

    try {
      await this.state.model.save();
      this.state.editing = false;
    } catch (error) {
      console.error('Failed to save todo:', error);
      this.state.model['v-s:title'] = [prev];
    }
  }

  async handleDestroy() {
    // Dispatch event to let parent handle removal from list
    this.dispatchEvent(new CustomEvent('destroy-todo', {
      detail: { todo: this.state.model },
      bubbles: true
    }));

    try {
      await this.state.model.remove();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  }

  render() {
    return html`
      <div class="view">
        <input class="toggle"
               type="checkbox"
               name="todo-completed"
               aria-label="Toggle todo completed"
               checked="{this.completed}"
               onchange="{handleToggle}" />

        <!-- Using property directly on label for reactive title display -->
        <label ondblclick="{handleEdit}">{this.title}</label>

        <button class="destroy"
                aria-label="Delete todo"
                onclick="{handleDestroy}"></button>
      </div>

      <!-- Editing input -->
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

