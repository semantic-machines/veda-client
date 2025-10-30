import { Component, html, Model, If, Loop } from '../../../src/index.js';
import TodoHeader from './TodoHeader.js';
import TodoItem from './TodoItem.js';
import TodoFooter from './TodoFooter.js';

export default class TodoApp extends Component(HTMLElement) {
  static tag = 'todo-app';

  constructor() {
    super();
    this.state = this.reactive({
      filter: 'all'
    });

    this._onHashChange = null;

    // Bind event handlers once in constructor
    this.handleToggleAll = this.handleToggleAll.bind(this);
    this.handleNewTodo = this.handleNewTodo.bind(this);
    this.handleToggleTodo = this.handleToggleTodo.bind(this);
    this.handleDestroyTodo = this.handleDestroyTodo.bind(this);
    this.handleSaveTodo = this.handleSaveTodo.bind(this);
    this.handleClearCompleted = this.handleClearCompleted.bind(this);
  }

  // Get todos directly from model - single source of truth
  get todos() {
    return this.model?.['v-s:hasTodo'] || [];
  }

  // Computed property for filtered todos - automatically reactive
  get filteredTodos() {
    const filter = this.state.filter;
    if (filter === 'active') return this.activeTodos;
    if (filter === 'completed') return this.completedTodos;
    return this.todos;
  }

  async connectedCallback() {
    await super.connectedCallback();

    if (this.model['v-s:hasTodo']) {
      await Promise.all(this.model['v-s:hasTodo'].map(todo => todo.load()));
    }

    this._onHashChange = () => {
      this.state.filter = this.getFilterFromHash();
    };
    window.addEventListener('hashchange', this._onHashChange);

    this.state.filter = this.getFilterFromHash();

    // Register event listeners with pre-bound handlers
    this.addEventListener('new-todo', this.handleNewTodo);
    this.addEventListener('toggle-todo', this.handleToggleTodo);
    this.addEventListener('destroy-todo', this.handleDestroyTodo);
    this.addEventListener('save-todo', this.handleSaveTodo);
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

    this.model.addValue('v-s:hasTodo', todo);

    try {
      await Promise.all([todo.save(), this.model.save()]);
      // Model is reactive - UI updates automatically
    } catch (error) {
      console.error('Failed to create todo:', error);
      this.model.removeValue('v-s:hasTodo', todo);
    }
  }

  async handleToggleTodo(event) {
    const { id } = event.detail;
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;

    const prev = !!todo['v-s:completed']?.[0];
    todo['v-s:completed'] = [!prev];

    try {
      await todo.save();
      // Model properties are reactive - no manual trigger needed
    } catch (error) {
      console.error('Failed to toggle todo:', error);
      todo['v-s:completed'] = [prev];
    }
  }

  async handleDestroyTodo(event) {
    const { id } = event.detail;
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;

    this.model.removeValue('v-s:hasTodo', todo);

    try {
      await Promise.all([todo.remove(), this.model.save()]);
      // Model is reactive - UI updates automatically
    } catch (error) {
      console.error('Failed to delete todo:', error);
      this.model.addValue('v-s:hasTodo', todo);
    }
  }

  async handleSaveTodo(event) {
    const { id, title } = event.detail;

    if (!title) {
      await this.handleDestroyTodo(event);
      return;
    }

    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;

    const prev = todo['v-s:title']?.[0] || '';
    todo['v-s:title'] = [title];

    try {
      await todo.save();
    } catch (error) {
      console.error('Failed to save todo:', error);
      todo['v-s:title'] = [prev];
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
      // Model properties are reactive - no manual trigger needed
    } catch (error) {
      console.error('Failed to toggle all todos:', error);
      this.todos.forEach(t => {
        const prev = prevMap.get(t.id);
        t['v-s:completed'] = [prev];
      });
    }
  }

  async handleClearCompleted() {
    const completed = this.completedTodos;

    completed.forEach(t => this.model.removeValue('v-s:hasTodo', t));

    try {
      await Promise.all([...completed.map(t => t.remove()), this.model.save()]);
      // Model is reactive - UI updates automatically
    } catch (error) {
      console.error('Failed to clear completed:', error);
      completed.forEach(t => this.model.addValue('v-s:hasTodo', t));
    }
  }

  render() {
    return html`
      <section class="todoapp">
        <${TodoHeader}></${TodoHeader}>

        <${If} condition="{this.hasTodos}">
          <template>
            <section class="main">
              <input id="toggle-all"
                     class="toggle-all"
                     type="checkbox"
                     name="toggle-all"
                     aria-label="Toggle all todos"
                     checked="{this.allCompleted}"
                     onchange="{handleToggleAll}"/>
              <label for="toggle-all">Mark all as complete</label>

              <ul class="todo-list">
                <${Loop} items="{this.filteredTodos}" item-key="id">
                  <template>
                    <li is="${TodoItem}"></li>
                  </template>
                </${Loop}>
              </ul>
            </section>

            <${TodoFooter}
              active-count="{this.activeTodos.length}"
              completed-count="{this.completedTodos.length}"
              filter="{this.state.filter}">
            </${TodoFooter}>
          </template>
        </${If}>
      </section>

      <footer class="info">
        <p>Double-click to edit a todo</p>
        <p>Built with <a href="https://github.com/semantic-machines/veda-client">Veda Framework</a></p>
        <p>Part of <a href="http://todomvc.com">TodoMVC</a></p>
      </footer>
    `;
  }
}

customElements.define(TodoApp.tag, TodoApp);
