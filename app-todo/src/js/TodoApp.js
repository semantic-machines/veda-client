import { Component, html, Model, reactive, Loop, If } from '../../../src/index.js';
import TodoHeader from './TodoHeader.js';
import TodoItem from './TodoItem.js';
import TodoFooter from './TodoFooter.js';

export default class TodoApp extends Component(HTMLElement) {
  static tag = 'todo-app';

  constructor() {
    super();
    // Reactive state instead of plain properties
    this.state = reactive({
      filter: 'all',
      todos: []
    });
    this._onHashChange = null;
  }

  async connectedCallback() {
    await super.connectedCallback();

    // Load todos from model into reactive state
    if (this.model['v-s:hasTodo']) {
      await Promise.all(this.model['v-s:hasTodo'].map(todo => todo.load()));
      this.state.todos = this.model['v-s:hasTodo'] || [];
    }

    // Setup hash change listener
    this._onHashChange = () => {
      this.state.filter = this.getFilterFromHash();
    };
    window.addEventListener('hashchange', this._onHashChange);

    this.state.filter = this.getFilterFromHash();

    // Setup event listeners
    this.addEventListener('new-todo', this.handleNewTodo.bind(this));
    this.addEventListener('toggle-todo', this.handleToggleTodo.bind(this));
    this.addEventListener('destroy-todo', this.handleDestroyTodo.bind(this));
    this.addEventListener('save-todo', this.handleSaveTodo.bind(this));
    this.addEventListener('clear-completed', this.handleClearCompleted.bind(this));
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

  // Computed properties with reactive dependencies
  get filteredTodos() {
    if (this.state.filter === 'active') {
      return this.state.todos.filter(t => !t['v-s:completed']?.[0]);
    }
    if (this.state.filter === 'completed') {
      return this.state.todos.filter(t => t['v-s:completed']?.[0]);
    }
    return this.state.todos;
  }

  get activeTodos() {
    return this.state.todos.filter(t => !t['v-s:completed']?.[0]);
  }

  get completedTodos() {
    return this.state.todos.filter(t => t['v-s:completed']?.[0]);
  }

  get allCompleted() {
    return this.state.todos.length > 0 && this.activeTodos.length === 0;
  }

  get hasTodos() {
    return this.state.todos.length > 0;
  }

  get hasCompletedTodos() {
    return this.completedTodos.length > 0;
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
      // Update reactive state - triggers automatic re-render via Loop
      this.state.todos = [...this.state.todos, todo];
    } catch (error) {
      console.error('Failed to create todo:', error);
      this.model.removeValue('v-s:hasTodo', todo);
    }
  }

  async handleToggleTodo(event) {
    const { id } = event.detail;
    const todo = this.state.todos.find(t => t.id === id);
    if (!todo) return;

    const prev = !!todo['v-s:completed']?.[0];
    todo['v-s:completed'] = [!prev];

    try {
      await todo.save();
      // Trigger reactivity - Loop will update only this item
      this.state.todos = [...this.state.todos];
    } catch (error) {
      console.error('Failed to toggle todo:', error);
      todo['v-s:completed'] = [prev];
    }
  }

  async handleDestroyTodo(event) {
    const { id } = event.detail;
    const todo = this.state.todos.find(t => t.id === id);
    if (!todo) return;

    this.model.removeValue('v-s:hasTodo', todo);

    try {
      await Promise.all([todo.remove(), this.model.save()]);
      // Update reactive state - Loop will remove only this item
      this.state.todos = this.state.todos.filter(t => t.id !== id);
    } catch (error) {
      console.error('Failed to delete todo:', error);
      this.model.addValue('v-s:hasTodo', todo);
      this.state.todos = [...this.state.todos, todo];
    }
  }

  async handleSaveTodo(event) {
    const { id, title } = event.detail;

    if (!title) {
      await this.handleDestroyTodo(event);
      return;
    }

    const todo = this.state.todos.find(t => t.id === id);
    if (!todo) return;

    const prev = todo['v-s:title']?.[0] || '';
    todo['v-s:title'] = [title];

    try {
      await todo.save();
      // Trigger reactivity
      this.state.todos = [...this.state.todos];
    } catch (error) {
      console.error('Failed to save todo:', error);
      todo['v-s:title'] = [prev];
    }
  }

  async handleToggleAll() {
    const newState = !this.allCompleted;
    const prevMap = new Map();

    this.state.todos.forEach(t => {
      prevMap.set(t.id, !!t['v-s:completed']?.[0]);
      t['v-s:completed'] = [newState];
    });

    try {
      await Promise.all(this.state.todos.map(t => t.save()));
      // Trigger reactivity
      this.state.todos = [...this.state.todos];
    } catch (error) {
      console.error('Failed to toggle all todos:', error);
      this.state.todos.forEach(t => {
        const prev = prevMap.get(t.id);
        t['v-s:completed'] = [prev];
      });
      this.state.todos = [...this.state.todos];
    }
  }

  async handleClearCompleted() {
    const completed = this.completedTodos;

    completed.forEach(t => this.model.removeValue('v-s:hasTodo', t));

    try {
      await Promise.all([...completed.map(t => t.remove()), this.model.save()]);
      // Update reactive state - Loop will remove all completed items
      this.state.todos = this.state.todos.filter(t => !t['v-s:completed']?.[0]);
    } catch (error) {
      console.error('Failed to clear completed:', error);
      completed.forEach(t => this.model.addValue('v-s:hasTodo', t));
      this.state.todos = [...this.state.todos];
    }
  }

  render() {
    return html`
      <section class="todoapp">
        <${TodoHeader.tag}></${TodoHeader.tag}>

        <veda-if condition="{this.hasTodos}">
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
              <veda-loop items="{this.filteredTodos}" item-key="id">
                <template>
                  <li is="${TodoItem.tag}"></li>
                </template>
              </veda-loop>
            </ul>
          </section>

          <${TodoFooter.tag}
            active-count="${this.activeTodos.length}"
            completed-count="${this.completedTodos.length}"
            filter="${this.state.filter}">
          </${TodoFooter.tag}>
        </veda-if>
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



