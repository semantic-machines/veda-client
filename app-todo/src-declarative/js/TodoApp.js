import { Component, html, If, Loop } from '../../../src/index.js';
import Model from '../../../src/Model.js';
import TodoHeader from './TodoHeader.js';
import TodoItem from './TodoItem.js';
import TodoFooter from './TodoFooter.js';

/**
 * Declarative TodoMVC using property/rel components
 *
 * This version demonstrates:
 * - property component for displaying single values
 * - rel component for displaying related models (todos)
 * - Minimal JavaScript - most logic in templates
 */
export default class TodoApp extends Component(HTMLElement) {
  static tag = 'todo-app-declarative';

  constructor() {
    super();
    this.state.filter = 'all';

    this._onHashChange = null;

    // Bind handlers
    this.handleToggleAll = this.handleToggleAll.bind(this);
    this.handleNewTodo = this.handleNewTodo.bind(this);
    this.handleDestroyTodo = this.handleDestroyTodo.bind(this);
    this.handleClearCompleted = this.handleClearCompleted.bind(this);
  }

  async connectedCallback() {
    await super.connectedCallback();

    if (this.state.model['v-s:hasTodo']) {
      await Promise.all(this.state.model['v-s:hasTodo'].map(todo => todo.load()));
    }

    this._onHashChange = () => {
      this.state.filter = this.getFilterFromHash();
    };
    window.addEventListener('hashchange', this._onHashChange);

    this.state.filter = this.getFilterFromHash();

    this.addEventListener('new-todo', this.handleNewTodo);
    this.addEventListener('destroy-todo', this.handleDestroyTodo);
    this.addEventListener('clear-completed', this.handleClearCompleted);
  }

  disconnectedCallback() {
    if (this._onHashChange) {
      window.removeEventListener('hashchange', this._onHashChange);
      this._onHashChange = null;
    }
    super.disconnectedCallback?.();
  }

  getFilterFromHash() {
    const hash = window.location.hash.replace('#/', '');
    return ['all', 'active', 'completed'].includes(hash) ? hash : 'all';
  }

  // Computed: all todos from model
  get todos() {
    return this.state.model?.['v-s:hasTodo'] || [];
  }

  // Computed: filtered by current filter
  get filteredTodos() {
    const todos = this.todos;
    if (this.state.filter === 'active') {
      return todos.filter(t => !t['v-s:completed']?.[0]);
    } else if (this.state.filter === 'completed') {
      return todos.filter(t => t['v-s:completed']?.[0]);
    }
    return todos;
  }

  get activeTodos() {
    return this.todos.filter(t => !t['v-s:completed']?.[0]);
  }

  get completedTodos() {
    return this.todos.filter(t => t['v-s:completed']?.[0]);
  }

  get allCompleted() {
    return this.todos.length > 0 && this.activeTodos.length === 0;
  }

  get hasTodos() {
    return this.todos.length > 0;
  }

  async handleNewTodo(event) {
    const { title } = event.detail;
    const todo = new Model();
    todo['rdf:type'] = [new Model('v-s:Todo')];
    todo['v-s:title'] = [title];
    todo['v-s:completed'] = [false];

    this.state.model.addValue('v-s:hasTodo', todo);

    try {
      await Promise.all([todo.save(), this.state.model.save()]);
    } catch (error) {
      console.error('Failed to create todo:', error);
      this.state.model.removeValue('v-s:hasTodo', todo);
    }
  }

  async handleToggleAll() {
    const newState = !this.allCompleted;
    const prevMap = new Map();

    this.todos.forEach(t => {
      prevMap.set(t.id, !!t['v-s:completed']?.[0]);
      t['v-s:completed'] = [newState];
    });

    try {
      await Promise.all(this.todos.map(t => t.save()));
    } catch (error) {
      console.error('Failed to toggle all todos:', error);
      this.todos.forEach(t => {
        const prev = prevMap.get(t.id);
        t['v-s:completed'] = [prev];
      });
    }
  }

  async handleDestroyTodo(event) {
    const { todo } = event.detail;

    this.state.model.removeValue('v-s:hasTodo', todo);

    try {
      // TodoItem already calls todo.remove(), we only update the list
      await this.state.model.save();
    } catch (error) {
      console.error('Failed to remove todo from list:', error);
      this.state.model.addValue('v-s:hasTodo', todo);
    }
  }

  async handleClearCompleted() {
    const completed = this.completedTodos;

    completed.forEach(t => this.state.model.removeValue('v-s:hasTodo', t));

    try {
      await Promise.all([...completed.map(t => t.remove()), this.state.model.save()]);
    } catch (error) {
      console.error('Failed to clear completed:', error);
      completed.forEach(t => this.state.model.addValue('v-s:hasTodo', t));
    }
  }

  render() {
    return html`
      <section class="todoapp">
        <${TodoHeader}></${TodoHeader}>

        <${If} condition="{this.hasTodos}">
          <section class="main">
            <input id="toggle-all"
                   class="toggle-all"
                   type="checkbox"
                   name="toggle-all"
                   aria-label="Toggle all todos"
                   checked="{this.allCompleted}"
                   onchange="{handleToggleAll}"/>
            <label for="toggle-all">Mark all as complete</label>

            <!-- Filtered list with Loop for UI-driven filtering -->
            <ul class="todo-list">
              <${Loop} items="{this.filteredTodos}" key="id" as="todo">
                <li is="${TodoItem.tag}" :model="{todo}"></li>
              </${Loop}>
            </ul>
          </section>

          <${TodoFooter}
            :active-count="{this.activeTodos.length}"
            :completed-count="{this.completedTodos.length}"
            :filter="{this.state.filter}">
          </${TodoFooter}>
        </${If}>
      </section>

      <footer class="info">
        <p>Double-click to edit a todo</p>
        <p>Built with <a href="https://github.com/semantic-machines/veda-client">Veda Framework</a></p>
        <p>Part of <a href="http://todomvc.com">TodoMVC</a> - Declarative with property/rel</p>
      </footer>
    `;
  }
}

customElements.define(TodoApp.tag, TodoApp);

