import { Component, html, Model } from '../../../src/index.js';
import TodoHeader from './TodoHeader.js';
import TodoItem from './TodoItem.js';
import TodoFooter from './TodoFooter.js';

export default class TodoApp extends Component(HTMLElement) {
  static tag = 'todo-app';

  constructor() {
    super();
    this.filter = 'all';
    this._didInitialFocus = false;
    this._onHashChange = null;
    this._shouldFocusInput = false;
    this._isFilterChanging = false;
  }

  async connectedCallback() {
    await super.connectedCallback();

    if (this.model['v-s:hasTodo']) {
      await Promise.all(this.model['v-s:hasTodo'].map(todo => todo.load()));
      this.update();
      requestAnimationFrame(() => this.applyToggleAllState());
    }

    this._onHashChange = () => {
      this._isFilterChanging = true;

      this.filter = this.getFilterFromHash();
      this.update();

      requestAnimationFrame(() => {
        this.applyToggleAllState();
        this._isFilterChanging = false;
      });
    };
    window.addEventListener('hashchange', this._onHashChange);

    this.filter = this.getFilterFromHash();
    this.update();
    requestAnimationFrame(() => this.applyToggleAllState());

    this.addEventListener('new-todo', this.handleNewTodo.bind(this));
    this.addEventListener('toggle-todo', this.handleToggleTodo.bind(this));
    this.addEventListener('destroy-todo', this.handleDestroyTodo.bind(this));
    this.addEventListener('save-todo', this.handleSaveTodo.bind(this));
    this.addEventListener('clear-completed', this.handleClearCompleted.bind(this));

    requestAnimationFrame(() => {
      if (!this._didInitialFocus) {
        this._didInitialFocus = true;
        this._shouldFocusInput = true;
        this.focusNewTodoInput();
      }
    });
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

  get todos() {
    return this.model['v-s:hasTodo'] || [];
  }

  get filteredTodos() {
    if (this.filter === 'active') return this.todos.filter(t => !t['v-s:completed']?.[0]);
    if (this.filter === 'completed') return this.todos.filter(t => t['v-s:completed']?.[0]);
    return this.todos;
  }

  get activeTodos() { return this.todos.filter(t => !t['v-s:completed']?.[0]); }
  get completedTodos() { return this.todos.filter(t => t['v-s:completed']?.[0]); }
  get allCompleted() { return this.todos.length > 0 && this.activeTodos.length === 0; }

  focusNewTodoInput() {
    if (!this._shouldFocusInput || this._isFilterChanging) return;

    const header = this.querySelector('todo-header');
    if (!header) return;
    const input = header.querySelector('.new-todo');
    if (input) {
      // Double check that we're not in the middle of a filter change
      if (this._isFilterChanging) return;

      // Use requestAnimationFrame for better timing
      requestAnimationFrame(() => {
        if (this._isFilterChanging) return;
        if (document.activeElement !== input) {
          input.focus();
        }
      });
    }
    this._shouldFocusInput = false;
  }

  applyToggleAllState() {
    const input = this.querySelector('#toggle-all');
    if (input) input.checked = this.allCompleted;
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
      this.update();
      requestAnimationFrame(() => {
        this.applyToggleAllState();
        this._shouldFocusInput = true;
        this.focusNewTodoInput();
      });
    } catch (error) {
      console.error('Failed to create todo:', error);
      this.model.removeValue('v-s:hasTodo', todo);
      this.update();
    }
  }

  async handleToggleTodo(event) {
    const { id } = event.detail;
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;
    const prev = !!todo['v-s:completed']?.[0];
    todo['v-s:completed'] = [!prev];
    try { await todo.save(); }
    catch (error) { console.error('Failed to toggle todo:', error); todo['v-s:completed'] = [prev]; }
    if (prev !== !!todo['v-s:completed']?.[0]) this.update();
    requestAnimationFrame(() => this.applyToggleAllState());
  }

  async handleDestroyTodo(event) {
    const { id } = event.detail;
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;
    this.model.removeValue('v-s:hasTodo', todo);
    try { await Promise.all([todo.remove(), this.model.save()]); }
    catch (error) { console.error('Failed to delete todo:', error); this.model.addValue('v-s:hasTodo', todo); }
    this.update();
    requestAnimationFrame(() => this.applyToggleAllState());
  }

  async handleSaveTodo(event) {
    const { id, title } = event.detail;
    if (!title) { await this.handleDestroyTodo(event); return; }
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;
    const prev = todo['v-s:title']?.[0] || '';
    todo['v-s:title'] = [title];
    try { await todo.save(); }
    catch (error) { console.error('Failed to save todo:', error); todo['v-s:title'] = [prev]; }
    if (prev !== (todo['v-s:title']?.[0] || '')) this.update();
    requestAnimationFrame(() => this.applyToggleAllState());
  }

  async handleToggleAll() {
    const allCompleted = this.todos.every(t => t['v-s:completed']?.[0]);
    const newState = !allCompleted;
    const prevMap = new Map();
    this.todos.forEach(t => prevMap.set(t.id, !!t['v-s:completed']?.[0]));
    this.todos.forEach(t => { t['v-s:completed'] = [newState]; });
    try { await Promise.all(this.todos.map(t => t.save())); }
    catch (error) {
      console.error('Failed to toggle all todos:', error);
      this.todos.forEach(t => { const prev = prevMap.get(t.id); t['v-s:completed'] = [prev]; });
    }
    this.update();
    requestAnimationFrame(() => this.applyToggleAllState());
  }

  async handleClearCompleted() {
    const completed = this.completedTodos;
    completed.forEach(t => this.model.removeValue('v-s:hasTodo', t));
    try { await Promise.all([...completed.map(t => t.remove()), this.model.save()]); }
    catch (error) { console.error('Failed to clear completed:', error); completed.forEach(t => this.model.addValue('v-s:hasTodo', t)); }
    this.update();
    requestAnimationFrame(() => this.applyToggleAllState());
  }

  render() {
    return html`
      <section class="todoapp">
        <${TodoHeader.tag}></${TodoHeader.tag}>
        ${this.todos.length > 0 ? html`
          <section class="main">
            <input id="toggle-all" class="toggle-all" type="checkbox" name="toggle-all" aria-label="Toggle all todos" ?checked="${this.allCompleted}" onchange="{{handleToggleAll}}"/>
            <label for="toggle-all">Mark all as complete</label>
            <ul class="todo-list">
              ${this.filteredTodos.map(todo => html`<li is="${TodoItem.tag}" about="${todo.id}"></li>`)}
            </ul>
          </section>
          <${TodoFooter.tag}
            active-count="${this.activeTodos.length}"
            completed-count="${this.completedTodos.length}"
            filter="${this.filter}">
          </${TodoFooter.tag}>
        ` : ''}
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



