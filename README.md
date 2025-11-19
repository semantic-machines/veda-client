# Veda Client Framework

A lightweight reactive framework for building semantic web applications with fine-grained reactivity and RDF/linked data support.

## Features

- 🎯 **Fine-grained reactivity** - Vue 3-inspired reactive system with automatic dependency tracking
- 🧩 **Web Components** - Built on native Custom Elements API
- 🔗 **Semantic data** - First-class RDF/linked data model support
- 📝 **Declarative templates** - JSX-like syntax with reactive expressions
- 🔄 **Built-in components** - Loop, If, Property, Relation components
- 📦 **Minimal footprint** - 48 KB browser bundle, 82 KB with Node.js (ws)
- 🎨 **TypeScript** - Full type definitions included

## Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/semantic-machines/veda-client.git
cd veda-client

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test
```

### Your First Component

```javascript
import Component, { html } from './src/components/Component.js';

class Counter extends Component(HTMLElement) {
  static tag = 'app-counter';

  constructor() {
    super();
    this.state = this.reactive({ count: 0 });
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

### Reactive List with Loop

```javascript
import { Loop } from './src/components/LoopComponent.js';

class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({
      todos: [
        { id: 1, text: 'Learn Veda', done: false },
        { id: 2, text: 'Build app', done: false }
      ]
    });
  }

  get todos() {
    return this.state.todos;
  }

  render() {
    return html`
      <ul>
        <${Loop} items="{this.todos}" item-key="id">
          <li>{this.model.text}</li>
        </${Loop}>
      </ul>
    `;
  }
}
```

## Documentation

- **[API Reference](./API.md)** - Complete API documentation
- **[Architecture Guide](./ARCHITECTURE.md)** - Framework internals and design decisions
- **[Reactivity Guide](./REACTIVITY.md)** - Comprehensive reactivity tutorial
- **[Changelog](./CHANGELOG.md)** - Version history and breaking changes
- **[Migration Guide](./MIGRATION.md)** - Upgrading from previous versions
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[Security](./SECURITY.md)** - Security best practices
- **[Limitations](./LIMITATIONS.md)** - Known limitations and workarounds
- **[Roadmap](./ROADMAP.md)** - Future plans

## Examples

- **TodoMVC** - Full-featured todo app (`app-todo/`)
  - [Imperative version](dist/app-todo/imperative.html) - Manual control with Loop
  - [Declarative version](dist/app-todo/declarative.html) - Property bindings
- **Simple examples** - See `examples/` directory

## Core Concepts

### Reactivity

```javascript
import { reactive, effect, computed } from './src/Reactive.js';

const state = reactive({ count: 0 });

effect(() => {
  console.log('Count:', state.count);
});

state.count++; // Logs: "Count: 1"
```

### Semantic Data Models

```javascript
import Model from './src/Model.js';

const person = new Model('d:Person1');
await person.load();
console.log(person['v-s:name']); // ['John Doe']

person['v-s:age'] = [30];
await person.save();
```

### Built-in Components

```javascript
import { Loop, If } from './src/index.js';

// Conditional rendering
<${If} condition="{this.isVisible}">
  <div>Content</div>
</${If}>

// List rendering with reconciliation
<${Loop} items="{this.items}" item-key="id">
  <item-card></item-card>
</${Loop}>
```

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

Requires:
- Custom Elements v1
- ES Modules
- Proxy
- WeakMap

## Bundle Size

- **Browser**: 48 KB (minified, without ws)
- **Node.js**: 82 KB (minified, includes ws for WebSocket support)
- Both versions are bundled and tree-shakeable

## Testing

```bash
# All tests
pnpm test

# Unit tests only (fast)
pnpm test:unit

# Integration tests (requires server)
pnpm test:integration
```

Test coverage:
- **>99%** with integration tests (requires backend: `pnpm c8`)
- **>90%** unit tests only (`pnpm c8:unit`)

**[See test/README.md for detailed testing guide](./test/README.md)**

## TypeScript

Full TypeScript definitions included:

```typescript
import Component, { html } from './src/components/Component.js';
import type { Reactive } from './src/Reactive.js';

interface AppState {
  count: number;
}

class App extends Component(HTMLElement) {
  state: Reactive<AppState>;

  constructor() {
    super();
    this.state = this.reactive<AppState>({ count: 0 });
  }
}
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass (`pnpm test`)
5. Submit a pull request

**Testing guidelines:** See [test/README.md](./test/README.md) for test structure, best practices, and writing tests.

## License

MIT License - see [LICENSE](./LICENSE) for details

## Credits

Inspired by:
- Vue 3 reactivity system
- Lit HTML templates
- Semantic web standards (RDF, RDFS, OWL)

---

**[📖 Read the API docs](./API.md)** | **[🚀 View examples](./examples/)** | **[💬 Report issues](https://github.com/semantic-machines/veda-client/issues)**
