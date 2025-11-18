# TodoMVC - Two Approaches

This folder contains **two implementations** of TodoMVC using Veda Framework, demonstrating different rendering approaches:

1. **Imperative** - full manual control with `{expressions}`
2. **Declarative** - property binding with `property` attribute

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
├── src-declarative/        # Declarative version (property attribute)
│   └── js/
│       ├── TodoApp.js      # Main app with Loop
│       ├── TodoItem.js     # Uses property attribute
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
        <li is="${TodoItem}"></li>
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

## 🎯 Version 2: Declarative (property component)

**File**: `src-declarative/js/TodoApp.js`
**URL**: `declarative.html`

### Key Features:

- **Loop component** for rendering lists (same as imperative)
- **property component** for displaying model properties
- **Declarative data binding** via property attribute
- **Model-driven** architecture

### Example Code:

```javascript
render() {
  return html`
    <ul class="todo-list">
      <${Loop} items="{this.filteredTodos}">
        <li is="${TodoItem}"></li>
      </${Loop}>
    </ul>
  `;
}
```

### TodoItem with property:

```javascript
render() {
  return html`
    <label property="v-s:title" ondblclick="{handleEdit}"></label>
    <input checked="{this.completed}" />
  `;
}
```

**Pros:**
- ✅ Declarative property binding
- ✅ Automatic updates from model properties
- ✅ Less manual DOM manipulation
- ✅ Best for model-property display

**Cons:**
- ❌ Property component only for simple display
- ❌ Complex rendering still needs render method

---

## 🔄 Key Differences

| Feature | Imperative | Declarative (property) |
|---------|------------|----------------------|
| **List rendering** | `<Loop items="{array}">` | `<Loop items="{array}">` |
| **Value display** | `{this.title}` | `<label property="v-s:title">` |
| **Model binding** | Manual via `{this.model.prop}` | Automatic via `property` |
| **Filtering** | Computed property | Computed property |
| **JavaScript** | Full control | Declarative binding |
| **Use case** | Complex UIs | Model-property display |

---

## 📖 Component Syntax Reference

### Loop Component

```javascript
import { Loop } from 'framework';

<${Loop} items="{this.items}" item-key="id">
  <li is="${MyItem}"></li>
</${Loop}>
```

- **items**: Expression returning array
- **item-key**: Property for reconciliation (optional)
- **model**: Each child gets `model = item`
- Used in both imperative and declarative versions

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

### Use **Imperative approach** when:
- Building interactive, dynamic UIs
- Need full control over rendering
- Complex event handling
- Building real-time apps (chat, games)

### Use **property component** (Declarative) when:
- Displaying model properties directly
- Want automatic updates from model
- Simple one-way data binding
- Reducing manual DOM manipulation

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
