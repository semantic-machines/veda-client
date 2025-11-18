# Veda Client Framework Documentation

> **Quick Links**: [API Reference](./API_REFERENCE.md) | [Components Guide](./COMPONENTS.md) | [Reactivity System](./REACTIVITY.md) | [TypeScript Usage](./TYPESCRIPT_USAGE.md)

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Getting Started](#getting-started)
4. [Components](#components)
5. [Reactivity System](#reactivity-system)
6. [Template Syntax](#template-syntax)
7. [Built-in Components](#built-in-components)
8. [Model System](#model-system)
9. [Routing](#routing)
10. [Best Practices](#best-practices)
11. [Examples](#examples)

---

## Overview

Veda Client is a lightweight, reactive web framework for building semantic web applications. It combines:

- **Fine-grained reactivity** (Vue 3-inspired)
- **Web Components** (Custom Elements API)
- **Semantic data models** (RDF/linked data)
- **Declarative templates** (JSX-like syntax)

### Key Features

- ✅ **Reactive state management** with automatic dependency tracking
- ✅ **Component-based architecture** using native Web Components
- ✅ **Semantic data integration** with built-in Model system
- ✅ **Declarative templates** with reactive expressions
- ✅ **Built-in components** for data iteration and conditional rendering
- ✅ **TypeScript** support with full type definitions
- ✅ **Minimal footprint** (~47KB minified)

---

## Core Concepts

### 1. Components

Components are Web Components extended with reactivity and templating:

```javascript
import Component, { html } from './src/components/Component.js';

class MyComponent extends Component(HTMLElement) {
  static tag = 'my-component';

  constructor() {
    super();
    this.state = this.reactive({
      count: 0
    });
  }

  increment = () => {
    this.state.count++;
  }

  render() {
    return html`
      <div>
        <p>Count: {this.state.count}</p>
        <button onclick="{increment}">Increment</button>
      </div>
    `;
  }
}

customElements.define(MyComponent.tag, MyComponent);
```

### 2. Reactivity

The framework uses a fine-grained reactivity system based on `Proxy` and automatic dependency tracking:

```javascript
import { reactive, effect, computed } from './src/Reactive.js';

// Create reactive state
const state = reactive({
  count: 0,
  items: []
});

// Auto-tracking effects
effect(() => {
  console.log('Count changed:', state.count);
});

// Computed values
const doubled = computed(() => state.count * 2);
```

### 3. Models

Models represent semantic entities with RDF-style properties:

```javascript
import Model from './src/Model.js';

// Load model
const person = await Model.load('d:Person1');

// Access properties
console.log(person['v-s:name']); // ['John Doe']

// Modify
person['v-s:age'] = [30];
await person.save();
```

---

## Getting Started

### Installation

```bash
# Clone repository
git clone <repository-url>
cd veda-client

# Install dependencies
pnpm install

# Build
node build.mjs

# Run examples
cd app-todo
node build.mjs
```

### Your First Component

```javascript
import Component, { html } from './src/components/Component.js';

class HelloWorld extends Component(HTMLElement) {
  static tag = 'hello-world';

  constructor() {
    super();
    this.state = this.reactive({
      name: 'World'
    });
  }

  render() {
    return html`
      <h1>Hello, {this.state.name}!</h1>
    `;
  }
}

customElements.define(HelloWorld.tag, HelloWorld);
```

Use in HTML:

```html
<hello-world></hello-world>
```

---

## Components

### Component Lifecycle

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    // Initialize state
  }

  async connectedCallback() {
    // Component added to DOM
    await super.connectedCallback();
  }

  disconnectedCallback() {
    // Component removed from DOM
    super.disconnectedCallback();
  }

  render() {
    // Return template
    return html`<div>Content</div>`;
  }
}
```

### Component State

Use `reactive()` for reactive state:

```javascript
constructor() {
  super();
  this.state = this.reactive({
    loading: false,
    data: [],
    filter: 'all'
  });
}
```

### Computed Properties

Use getters for derived state:

```javascript
get filteredData() {
  return this.state.data.filter(item =>
    this.state.filter === 'all' || item.status === this.state.filter
  );
}
```

Use in templates with Loop:

```javascript
render() {
  return html`
    <ul>
      <${Loop} items="{this.filteredData}" item-key="id">
        <li>{this.model.name}</li>
      </${Loop}>
    </ul>
  `;
}
```

### Effects

Create side effects that automatically re-run when dependencies change:

```javascript
connectedCallback() {
  super.connectedCallback();

  this.effect(() => {
    console.log('Filter changed:', this.state.filter);
    // Will re-run whenever this.state.filter changes
  });
}
```

---

## Reactivity System

### Creating Reactive State

```javascript
import { reactive } from './src/Reactive.js';

const state = reactive({
  count: 0,
  user: {
    name: 'Alice',
    email: 'alice@example.com'
  },
  items: []
});
```

### Effects

Effects automatically track dependencies and re-run when they change:

```javascript
import { effect } from './src/Effect.js';

effect(() => {
  console.log('Count is:', state.count);
  // Runs immediately and whenever state.count changes
});
```

### Computed Values

```javascript
import { computed } from './src/Reactive.js';

const doubled = computed(() => state.count * 2);

console.log(doubled.value); // Access via .value
```

### Manual Tracking

```javascript
import { track, trigger } from './src/Effect.js';

// Track dependencies
track(target, 'propertyName');

// Trigger effects
trigger(target, 'propertyName');
```

---

## Template Syntax

### Reactive Expressions

Use `{expression}` for reactive values:

```javascript
render() {
  return html`
    <div>
      <p>Name: {this.state.name}</p>
      <p>Count: {this.state.count}</p>
    </div>
  `;
}
```

### Static Interpolation

Use `${expression}` for static (non-reactive) values:

```javascript
render() {
  return html`
    <div id="${this.elementId}">
      Static ID
    </div>
  `;
}
```

### Event Handlers

Bind event handlers with `{handlerName}`:

```javascript
class MyComponent extends Component(HTMLElement) {
  handleClick = () => {
    console.log('Clicked!');
  }

  render() {
    return html`
      <button onclick="{handleClick}">Click me</button>
    `;
  }
}
```

### Reactive Attributes

Attributes with reactive expressions update automatically:

```javascript
render() {
  return html`
    <input
      type="checkbox"
      checked="{this.state.isDone}"
      disabled="{this.state.isDisabled}" />
  `;
}
```

### Expression Limitations

The expression parser supports **only property access**:

```javascript
// ✅ Supported
{this.state.name}
{this.model.id}
{this.items.0.title}
{this.user?.email}

// ❌ Not supported
{this.count + 1}
{this.isActive ? 'Yes' : 'No'}
{this.items.length > 0}
```

For complex logic, use **computed properties**:

```javascript
get statusText() {
  return this.state.isActive ? 'Yes' : 'No';
}

render() {
  return html`<p>Status: {this.statusText}</p>`;
}
```

---

## Built-in Components

### If Component

Conditional rendering:

```javascript
import { If } from './src/components/IfComponent.js';

render() {
  return html`
    <${If} condition="{this.state.showContent}">
      <div>This content is conditional</div>
    </${If}>
  `;
}
```

### Loop Component

List rendering with reconciliation:

```javascript
import { Loop } from './src/components/LoopComponent.js';

render() {
  return html`
    <ul>
      <${Loop} items="{this.state.todos}" item-key="id">
        <li>{this.model.title}</li>
      </${Loop}>
    </ul>
  `;
}
```

Inside `Loop`, `this.model` refers to the current item.

### Property Component

Display model properties:

```html
<span property="v-s:title"></span>
<div property="rdfs:label"></div>
```

### Relation Component

Iterate over related models:

```html
<ul rel="v-s:hasTodo">
  <li property="v-s:title"></li>
</ul>
```

### Nesting Components

Components can be nested arbitrarily:

```javascript
render() {
  return html`
    <${Loop} items="{this.projects}" item-key="id">
      <div>
        <h2 property="v-s:title"></h2>
        <ul rel="v-s:hasTask">
          <li property="v-s:title"></li>
        </ul>
      </div>
    </${Loop}>
  `;
}
```

---

## Model System

### Loading Models

```javascript
import Model from './src/Model.js';

// Load by URI
const model = await Model.load('d:MyModel');

// Load multiple
const models = await Model.load(['d:Model1', 'd:Model2']);
```

### Accessing Properties

Properties are arrays (RDF-style):

```javascript
// Read
console.log(model['v-s:title']); // ['Title']

// Write
model['v-s:title'] = ['New Title'];

// Check existence
if (model.hasValue('v-s:creator')) {
  // ...
}
```

### Saving Models

```javascript
// Save changes
await model.save();

// Sync mode (for batch operations)
model.isSync(false);
model['v-s:prop1'] = ['value1'];
model['v-s:prop2'] = ['value2'];
model.isSync(true);
await model.save();
```

### Model Events

```javascript
model.on('modified', () => {
  console.log('Model changed');
});

model.on('beforeSave', () => {
  console.log('About to save');
});

model.on('afterSave', () => {
  console.log('Saved successfully');
});
```

### Creating Models

```javascript
const newModel = new Model();
newModel.id = 'd:NewModel' + Date.now();
newModel['rdf:type'] = ['v-s:Person'];
newModel['v-s:name'] = ['John Doe'];
await newModel.save();
```

---

## Routing

### Setup

```javascript
import Router from './src/Router.js';

const router = new Router();

router.add('#/', () => {
  console.log('Home page');
  // Render home component
});

router.add('#/about', () => {
  console.log('About page');
});

router.add('#/user/:id', (params) => {
  console.log('User ID:', params.id);
});

// Handle initial route
if (!location.hash) {
  location.hash = '#/';
}
router.route(location.hash);
```

### Navigation

```html
<a href="#/about">About</a>
<a href="#/user/123">User 123</a>
```

Or programmatically:

```javascript
router.go('#/about');
```

---

## Best Practices

### 1. Use Computed Properties

Instead of complex expressions in templates:

```javascript
// ❌ Bad
render() {
  return html`
    <div>${this.state.items.filter(i => i.active).length} active</div>
  `;
}

// ✅ Good
get activeCount() {
  return this.state.items.filter(i => i.active).length;
}

render() {
  return html`
    <div>{this.activeCount} active</div>
  `;
}
```

### 2. Bind Event Handlers

Use arrow functions to preserve `this` context:

```javascript
class MyComponent extends Component(HTMLElement) {
  handleClick = () => {  // Arrow function
    this.state.count++;
  }

  render() {
    return html`
      <button onclick="{handleClick}">Click</button>
    `;
  }
}
```

### 3. Use Effects for Side Effects

```javascript
connectedCallback() {
  super.connectedCallback();

  // Watch for changes
  this.effect(() => {
    if (this.state.searchQuery) {
      this.performSearch(this.state.searchQuery);
    }
  });
}
```

### 4. Single Source of Truth

Use model or state as the single source of truth:

```javascript
// ✅ Good - model is the source
get todos() {
  return this.model['v-s:hasTodo'] || [];
}

get activeTodos() {
  return this.todos.filter(t => !t['v-s:completed']?.[0]);
}
```

### 5. Component Composition

Break down complex UIs into smaller components:

```javascript
// TodoApp.js
render() {
  return html`
    <${TodoHeader}></${TodoHeader}>
    <${TodoList} items="{this.todos}"></${TodoList}>
    <${TodoFooter} count="{this.activeCount}"></${TodoFooter}>
  `;
}
```

### 6. Lifecycle Cleanup

Clean up resources in `disconnectedCallback`:

```javascript
disconnectedCallback() {
  // Effects are cleaned up automatically
  // Manual cleanup if needed:
  this.subscription?.cancel();
  super.disconnectedCallback();
}
```

---

## Examples

### Counter

```javascript
import Component, { html } from './src/components/Component.js';

class Counter extends Component(HTMLElement) {
  static tag = 'app-counter';

  constructor() {
    super();
    this.state = this.reactive({ count: 0 });
  }

  increment = () => this.state.count++;
  decrement = () => this.state.count--;

  render() {
    return html`
      <div>
        <button onclick="{decrement}">-</button>
        <span>{this.state.count}</span>
        <button onclick="{increment}">+</button>
      </div>
    `;
  }
}

customElements.define(Counter.tag, Counter);
```

### Todo List

```javascript
import Component, { html } from './src/components/Component.js';
import { Loop } from './src/components/LoopComponent.js';

class TodoList extends Component(HTMLElement) {
  static tag = 'todo-list';

  constructor() {
    super();
    this.state = this.reactive({
      todos: [],
      input: ''
    });
  }

  handleAdd = () => {
    if (this.state.input.trim()) {
      this.state.todos.push(this.reactive({
        id: Date.now(),
        text: this.state.input,
        done: false
      }));
      this.state.input = '';
    }
  }

  handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      this.handleAdd();
    }
  }

  handleInput = (e) => {
    this.state.input = e.target.value;
  }

  handleToggle = (e, node) => {
    // Access the todo item via the Loop's model context
    // which is set on the parent element
    const li = node.closest('li');
    if (li && li.model) {
      li.model.done = !li.model.done;
    }
  }

  render() {
    return html`
      <div>
        <input
          type="text"
          value="{this.state.input}"
          oninput="{handleInput}"
          onkeypress="{handleKeyPress}" />
        <button onclick="{handleAdd}">Add</button>

        <ul>
          <${Loop} items="{this.state.todos}" item-key="id">
            <li>
              <input
                type="checkbox"
                checked="{this.model.done}"
                onchange="{handleToggle}" />
              <span>{this.model.text}</span>
            </li>
          </${Loop}>
        </ul>
      </div>
    `;
  }
}

customElements.define(TodoList.tag, TodoList);
```

### Semantic Data Display

```javascript
import Component, { html } from './src/components/Component.js';
import Model from './src/Model.js';

class PersonCard extends Component(HTMLElement) {
  static tag = 'person-card';

  async connectedCallback() {
    this.model = await Model.load('d:Person1');
    await super.connectedCallback();
  }

  render() {
    return html`
      <div class="card">
        <h2 property="v-s:name"></h2>
        <p property="v-s:email"></p>

        <h3>Projects:</h3>
        <ul rel="v-s:hasProject">
          <li property="v-s:title"></li>
        </ul>
      </div>
    `;
  }
}

customElements.define(PersonCard.tag, PersonCard);
```

### Nested Lists with Filtering

```javascript
import Component, { html } from './src/components/Component.js';
import { Loop } from './src/components/LoopComponent.js';
import Model from './src/Model.js';

class ProjectList extends Component(HTMLElement) {
  static tag = 'project-list';

  constructor() {
    super();
    this.state = this.reactive({ filter: 'high' });
  }

  async connectedCallback() {
    this.model = await Model.load('d:Organization1');
    await super.connectedCallback();
  }

  get projects() {
    return this.model['v-s:hasProject'] || [];
  }

  get filteredTasks() {
    if (!this.model?.['v-s:hasTask']) return [];
    return this.model['v-s:hasTask'].filter(task =>
      task['v-s:priority'] === this.state.filter
    );
  }

  handleFilterChange = (e) => {
    this.state.filter = e.target.value;
  }

  render() {
    return html`
      <div>
        <select value="{this.state.filter}"
                onchange="{handleFilterChange}">
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>

        <${Loop} items="{this.projects}" item-key="id">
          <div>
            <h3 property="v-s:title"></h3>
            <ul>
              <${Loop} items="{this.filteredTasks}" item-key="id">
                <li property="v-s:title"></li>
              </${Loop}>
            </ul>
          </div>
        </${Loop}>
      </div>
    `;
  }
}

customElements.define(ProjectList.tag, ProjectList);
```

---

## API Reference

See individual module documentation:

- [Component System](./COMPONENTS.md)
- [Reactivity System](./REACTIVITY.md)
- [Effect System](./EFFECT_SYSTEM.md)
- [Limitations](./LIMITATIONS.md)
- [Roadmap](./ROADMAP.md)

---

## Live Examples

- **TodoMVC Implementation**: `app-todo/` - Full-featured todo app with both imperative and declarative versions
- **Component Syntax Tests**: `dist/test/test-template-syntax.html` - Live examples of all template syntax patterns
- **Simple Examples**: `examples/` - Minimal examples for learning

---

## TypeScript Support

The framework includes complete TypeScript definitions:

```typescript
import Component, { html } from './src/components/Component.js';
import { Reactive } from './src/Reactive.js';

interface TodoState {
  todos: Array<{ id: number; text: string; done: boolean }>;
  filter: 'all' | 'active' | 'completed';
}

class TodoApp extends Component(HTMLElement) {
  state: Reactive<TodoState>;

  constructor() {
    super();
    this.state = this.reactive<TodoState>({
      todos: [],
      filter: 'all'
    });
  }
}
```

---

## Contributing

See test suite in `test/` for comprehensive examples and edge cases.

Run tests:

```bash
pnpm test
```

---

## License

[License information]



