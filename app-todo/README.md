# TodoMVC - Veda Client Implementation

A TodoMVC implementation demonstrating both **imperative** and **declarative** approaches within the same application.

## Quick Start

```bash
# From project root
pnpm install
node build.mjs

# Open in browser
open http://localhost:8081/app-todo/
```

---

## Two Approaches in One App

This implementation showcases how Veda Framework supports both approaches:

### Declarative (property/rel components)

Values are automatically bound to model properties:

```html
<!-- In TodoHeader: title from model -->
<h1 property="rdfs:label"></h1>

<!-- In TodoFooter: list type via rel -->
<span rel="rdf:type" property="rdfs:label"></span>
```

**When to use:**
- Simple display of model data
- No event handlers needed on the element
- Automatic reactivity without computed getters

### Imperative (expressions + computed getters)

Values are explicitly accessed via expressions:

```html
<!-- In TodoItem: title via getter -->
<label ondblclick="{handleEdit}">{this.title}</label>

<!-- In TodoFooter: count via state -->
<span>{this.state.activeCount}</span>
```

**When to use:**
- Need event handlers on the element
- Complex transformations or filtering
- Combining multiple values

---

## Component Architecture

| Component | Approach | Why |
|-----------|----------|-----|
| **TodoHeader** | Declarative | `property="rdfs:label"` for list title |
| **TodoItem** | Imperative | Need `ondblclick` for editing |
| **TodoFooter** | Hybrid | Counts via expressions, type via `rel` |
| **TodoApp** | Imperative | Complex state management with `Loop`, `If` |

---

## Key Features Demonstrated

- **Loop component** for reactive list rendering with reconciliation
- **If component** for conditional rendering
- **effect()** for side effects (checkbox sync)
- **watch()** for reacting to value changes (CSS classes)
- **property/rel** components for declarative data binding
- **Custom events** for parent-child communication
- **Error handling** with optimistic updates and rollback

---

## Build

```bash
# Build
npm run build

# Watch mode
npm run watch
```

---

## Learn More

- **[Main Documentation](../README.md)**
- **[API Reference](../API.md)**
- **[Reactivity Guide](../REACTIVITY.md)**
