# TodoMVC - Veda Client Implementation

Two implementations of TodoMVC demonstrating different approaches with Veda Framework.

## Quick Start

```bash
# From project root
pnpm install
node build.mjs

# Open in browser
open http://localhost:8081/app-todo/
```

Choose **Imperative** or **Declarative** version.

---

## Versions

### Imperative (`src/`)
- Manual rendering with `render()` methods
- Loop component for lists
- Full control over rendering logic
- **Best for:** Dynamic, interactive UIs

### Declarative (`src-declarative/`)
- Property component for model bindings
- Automatic updates from model
- Minimal JavaScript
- **Best for:** Model-driven UIs

---

## Key Differences

| Feature | Imperative | Declarative |
|---------|------------|-------------|
| List rendering | `<Loop>` + manual template | `<Loop>` + property binding |
| Value display | `{this.title}` | `<label property="v-s:title">` |
| Model binding | Manual expressions | Automatic via property |
| JavaScript | More code | Less code |

---

## Examples

### Imperative

```javascript
import { Loop } from '../src/components/LoopComponent.js';

render() {
  return html`
    <ul>
      <${Loop} items="{this.filteredTodos}" item-key="id">
        <li>
          <label>{this.title}</label>
          <input checked="{this.completed}" />
        </li>
      </${Loop}>
    </ul>
  `;
}
```

### Declarative

```javascript
render() {
  return html`
    <ul>
      <${Loop} items="{this.filteredTodos}" item-key="id">
        <li>
          <label property="v-s:title"></label>
          <input checked="{this.completed}" />
        </li>
      </${Loop}>
    </ul>
  `;
}
```

---

## Build

```bash
# Build both versions
npm run build

# Watch mode
npm run watch
```

---

## Learn More

- **[Main Documentation](../README.md)**
- **[API Reference](../API.md)**
- **[Reactivity Guide](../REACTIVITY.md)**

---

Both implementations are production-ready. Choose based on your use case.
