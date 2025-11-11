# Veda Client Framework

A lightweight, reactive web framework for building semantic web applications.

## Features

- 🎯 **Fine-grained reactivity** - Vue 3-inspired reactive system with automatic dependency tracking
- 🧩 **Web Components** - Built on native Custom Elements API
- 🔗 **Semantic data** - First-class support for RDF/linked data models
- 📝 **Declarative templates** - JSX-like syntax with reactive expressions
- 🔄 **Built-in components** - If, Loop, Property, Relation components
- 📦 **Minimal footprint** - ~47KB minified
- 🎨 **TypeScript support** - Full type definitions included

## Quick Start

```javascript
import Component, { html, reactive } from './src/components/Component.js';

class Counter extends Component(HTMLElement) {
  static tag = 'app-counter';

  constructor() {
    super();
    this.state = reactive({ count: 0 });
  }

  increment = () => this.state.count++;

  render() {
    return html`
      <div>
        <p>Count: {this.state.count}</p>
        <button onclick="{increment}">+</button>
      </div>
    `;
  }
}

customElements.define(Counter.tag, Counter);
```

## Installation

```bash
# Clone repository
git clone <repository-url>
cd veda-client

# Install dependencies
pnpm install

# Build
node build.mjs

# Run tests
pnpm test
```

## Documentation

- 📖 [Full Documentation](./DOCUMENTATION.md) - Complete framework guide
- 🧩 [Components Guide](./COMPONENTS.md) - Component system details
- ⚡ [Reactivity System](./REACTIVITY.md) - How reactivity works
- 🔄 [Effect System](./EFFECT_SYSTEM.md) - Fine-grained effects
- 📋 [Components Guide (TodoMVC)](./app-todo/COMPONENTS_GUIDE.md) - Quick reference
- ⚠️ [Limitations](./LIMITATIONS.md) - Known limitations
- 📝 [Changelog](./CHANGELOG.md) - Version history
- 🗺️ [Roadmap](./ROADMAP.md) - Future plans

## Examples

### Live Examples

- **TodoMVC Application**: `app-todo/` - Full-featured todo app
  - Imperative version: http://localhost:8888/dist/app-todo/imperative.html
  - Declarative version: http://localhost:8888/dist/app-todo/declarative.html
- **Syntax Tests**: http://localhost:8888/dist/test/test-template-syntax.html
- **Simple Examples**: `examples/` directory

### Counter Example

```javascript
import Component, { html, reactive } from './src/components/Component.js';

class Counter extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = reactive({ count: 0 });
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
```

### Todo List

```javascript
import Component, { html, reactive } from './src/components/Component.js';
import { Loop } from './src/components/LoopComponent.js';

class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = reactive({
      todos: [],
      input: ''
    });
  }

  handleAdd = () => {
    if (this.state.input.trim()) {
      this.state.todos.push({
        id: Date.now(),
        text: this.state.input,
        done: false
      });
      this.state.input = '';
    }
  }

  render() {
    return html`
      <div>
        <input value="{this.state.input}"
               oninput="{this.handleInput}" />
        <button onclick="{handleAdd}">Add</button>

        <ul>
          <${Loop} items="{this.state.todos}" item-key="id">
            <li>{this.model.text}</li>
          </${Loop}>
        </ul>
      </div>
    `;
  }

  handleInput = (e) => {
    this.state.input = e.target.value;
  }
}
```

### Semantic Data

```javascript
import Component, { html } from './src/components/Component.js';
import Model from './src/Model.js';

class PersonCard extends Component(HTMLElement) {
  async connectedCallback() {
    this.model = await Model.load('d:Person1');
    await super.connectedCallback();
  }

  render() {
    return html`
      <div>
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
```

## Core Concepts

### 1. Reactivity

```javascript
import { reactive, effect, computed } from './src/Reactive.js';

// Reactive state
const state = reactive({ count: 0 });

// Auto-tracking effects
effect(() => {
  console.log('Count:', state.count);
});

// Computed values
const doubled = computed(() => state.count * 2);
```

### 2. Components

Web Components with reactivity:

```javascript
class MyComponent extends Component(HTMLElement) {
  static tag = 'my-component';

  constructor() {
    super();
    this.state = reactive({ /* ... */ });
  }

  render() {
    return html`<div>...</div>`;
  }
}

customElements.define(MyComponent.tag, MyComponent);
```

### 3. Template Syntax

```javascript
render() {
  return html`
    <!-- Reactive expressions -->
    <p>{this.state.name}</p>

    <!-- Event handlers -->
    <button onclick="{handleClick}">Click</button>

    <!-- Reactive attributes -->
    <input checked="{this.state.isDone}" />

    <!-- Conditional rendering -->
    <${If} condition="{this.state.show}">
      <div>Content</div>
    </${If}>

    <!-- List rendering -->
    <${Loop} items="{this.state.items}" item-key="id">
      <div>{this.model.name}</div>
    </${Loop}>
  `;
}
```

### 4. Models

Semantic data with RDF-style properties:

```javascript
import Model from './src/Model.js';

// Load model
const model = await Model.load('d:MyModel');

// Access properties (always arrays)
console.log(model['v-s:title']); // ['Title']

// Modify
model['v-s:title'] = ['New Title'];
await model.save();
```

## Built-in Components

### If Component

```javascript
<${If} condition="{this.state.show}">
  <div>Conditional content</div>
</${If}>
```

### Loop Component

```javascript
<${Loop} items="{this.state.items}" item-key="id">
  <div>{this.model.name}</div>
</${Loop}>
```

### Property Component

```html
<span property="v-s:title"></span>
```

### Relation Component

```html
<ul rel="v-s:hasTodo">
  <li property="v-s:title"></li>
</ul>
```

## Architecture

```
src/
├── components/
│   ├── Component.js        # Base component class
│   ├── IfComponent.js      # Conditional rendering
│   ├── LoopComponent.js    # List rendering
│   ├── PropertyComponent.js # Property display
│   ├── RelationComponent.js # Relation iteration
│   ├── ValueComponent.js   # Base for Property/Relation
│   └── ExpressionParser.js # Template expression parser
├── Effect.js               # Effect system
├── Reactive.js             # Reactivity core
├── Model.js                # Semantic data models
├── Router.js               # Client-side routing
├── Backend.js              # Backend communication
├── Subscription.js         # Real-time updates
└── Util.js                 # Utilities
```

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

Requires native support for:
- Custom Elements v1
- ES Modules
- Proxy
- WeakMap

## TypeScript

Full TypeScript definitions included:

```typescript
import Component, { html } from './src/components/Component.js';
import { reactive, Reactive } from './src/Reactive.js';

interface AppState {
  count: number;
}

class App extends Component(HTMLElement) {
  state: Reactive<AppState>;

  constructor() {
    super();
    this.state = reactive<AppState>({ count: 0 });
  }
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific test
pnpm test -- test/Reactive.test.js
```

Test coverage includes:
- ✅ Reactivity system
- ✅ Effect tracking
- ✅ Component lifecycle
- ✅ Template syntax
- ✅ Expression parser
- ✅ If/Loop components
- ✅ Model system
- ✅ Router

## Performance

- **Bundle size**: ~47KB minified
- **Runtime**: Fine-grained reactivity ensures minimal re-renders
- **Memory**: WeakMap-based caching prevents memory leaks
- **Reconciliation**: Efficient list updates with keyed items

## Development

```bash
# Install dependencies
pnpm install

# Build framework
node build.mjs

# Watch mode
node watch.mjs

# Build TodoMVC
cd app-todo
node build.mjs

# Watch TodoMVC
node watch.mjs
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

[License information]

## Credits

Inspired by:
- Vue 3 reactivity system
- Lit HTML templates
- Semantic web standards (RDF, RDFS, OWL)



