# TodoMVC - Two Implementations

This folder contains **two implementations** of TodoMVC using Veda Framework, demonstrating different approaches.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build both versions
npm run build

# Start dev server (from parent directory)
cd .. && npm start

# Open in browser
open http://localhost:8081/app-todo/
```

Then choose between **Imperative** or **Declarative** version.

---

## 📁 File Structure

```
app-todo/
├── index.html              # Main entry - choose implementation
├── imperative.html         # Imperative version entry
├── declarative.html        # Declarative version entry
│
├── src/                    # Imperative version (Loop component)
│   └── js/
│       ├── TodoApp.js      # Main app with Loop
│       ├── TodoItem.js     # Manual rendering
│       ├── TodoFooter.js
│       └── TodoHeader.js
│
├── src-declarative/        # Declarative version (property/rel)
│   └── js/
│       ├── TodoApp.js      # Main app with rel
│       ├── TodoList.js     # Filter wrapper
│       ├── TodoItem.js     # Uses property components
│       ├── TodoFooter.js
│       └── TodoHeader.js
│
├── build.mjs               # Unified build script
├── watch.mjs               # Watch mode for development
└── package.json
```

---

## 🎯 Version 1: Imperative (Loop Component)

**File**: `src/js/TodoApp.js`
**URL**: `imperative.html`

### Key Features:

- **Loop component** for rendering lists
- **Manual rendering** with `render()` methods
- **Reactive expressions** `{this.property}`
- **Full control** over rendering logic

### Example Code:

```javascript
render() {
  return html`
    <ul>
      <${Loop} items="{this.filteredTodos}" item-key="id">
        <template>
          <li is="${TodoItem}"></li>
        </template>
      </${Loop}>
    </ul>
  `;
}
```

### TodoItem Rendering:

```javascript
render() {
  return html`
    <label>{this.title}</label>
    <input checked="{this.completed}" />
  `;
}
```

**Pros:**
- ✅ Full control over rendering
- ✅ Complex filtering logic easy to implement
- ✅ Clear data flow
- ✅ Best for dynamic, interactive UIs

**Cons:**
- ❌ More JavaScript code
- ❌ Manual template management

---

## 🎯 Version 2: Declarative (property/rel)

**File**: `src-declarative/js/TodoApp.js`
**URL**: `declarative.html`

### Key Features:

- **rel component** for automatic model iteration
- **property component** for displaying model properties
- **Minimal JavaScript** - logic in templates
- **Model-driven** architecture

### Example Code:

```javascript
render() {
  return html`
    <ul rel="v-s:hasTodo">
      <template>
        <${TodoList} filter="{this.state.filter}"></${TodoList}>
      </template>
    </ul>
  `;
}
```

### TodoItem with property:

```javascript
render() {
  return html`
    <label>
      <span property="v-s:title"></span>
    </label>
    <input checked="{this.completed}" />
  `;
}
```

**Pros:**
- ✅ Less JavaScript code
- ✅ Declarative model binding
- ✅ Automatic updates from model
- ✅ Best for CRUD/data-driven apps

**Cons:**
- ❌ Less control over rendering
- ❌ Filtering requires wrapper component

---

## 🔄 Key Differences

| Feature | Imperative (Loop) | Declarative (property/rel) |
|---------|-------------------|---------------------------|
| **List rendering** | `<Loop items="{array}">` | `<ul rel="property">` |
| **Value display** | `{this.title}` | `<span property="v-s:title">` |
| **Model binding** | Manual via `model` prop | Automatic via `rel` |
| **Filtering** | In computed property | Via wrapper component |
| **JavaScript** | More code | Less code |
| **Use case** | Interactive UIs | Data-driven apps |

---

## 📖 Component Syntax Reference

### Loop Component (Imperative)

```javascript
import { Loop } from 'framework';

<${Loop} items="{this.items}" item-key="id">
  <template>
    <li is="${MyItem}"></li>
  </template>
</${Loop}>
```

- **items**: Expression returning array
- **item-key**: Property for reconciliation
- **model**: Each child gets `model = item`

### rel Component (Declarative)

```html
<ul rel="v-s:hasTodo">
  <template>
    <my-item></my-item>
  </template>
</ul>
```

- **rel**: Model property name (must be array of models)
- **template**: Each instance gets `model = relatedModel`
- Automatic iteration over `this.model[rel]`

### property Component

```html
<!-- Simple display -->
<span property="rdfs:label"></span>

<!-- With template -->
<div property="v-s:title">
  <template>
    <strong><slot></slot></strong>
  </template>
</div>

<!-- Multiple values -->
<ul property="v-s:tags">
  <template>
    <li><slot></slot></li>
  </template>
</ul>
```

- **property**: Model property name
- **template**: Custom rendering
- **slot**: Replaced with value
- Automatic iteration for arrays

---

## 🚀 Running the Apps

```bash
# Build all versions
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Start dev server (from parent directory)
cd .. && npm start

# Open in browser
# Main page: http://localhost:8081/app-todo/
# Imperative: http://localhost:8081/app-todo/imperative.html
# Declarative: http://localhost:8081/app-todo/declarative.html
```

---

## 🎓 When to Use Which?

### Use **Loop Component** (Imperative) when:
- Building interactive, dynamic UIs
- Need complex filtering/sorting logic
- Want full control over rendering
- Building real-time apps (chat, games)

### Use **property/rel** (Declarative) when:
- Building CRUD applications
- Model is the source of truth
- Want minimal JavaScript
- Building admin panels, forms, data grids

---

## 💡 Best Practices

### For Both Versions:

1. **Model as source of truth**
   ```javascript
   get todos() {
     return this.model?.['v-s:hasTodo'] || [];
   }
   ```

2. **Computed properties for derived data**
   ```javascript
   get activeTodos() {
     return this.todos.filter(t => !t['v-s:completed']?.[0]);
   }
   ```

3. **Effects for side effects**
   ```javascript
   this.effect(() => {
     console.log('Count:', this.state.count);
   });
   ```

4. **Optimistic updates with rollback**
   ```javascript
   const prev = this.value;
   this.value = newValue;
   try {
     await this.save();
   } catch (error) {
     this.value = prev;
   }
   ```

---

## 📚 Learn More

- [Veda Framework Documentation](https://github.com/semantic-machines/veda-client)
- [Component API](../src/components/Component.js)
- [Loop Component](../src/components/LoopComponent.js)
- [Value/Property/Relation Components](../src/components/)

---

**Both implementations are production-ready and fully functional!** Choose the one that fits your use case best.
