# Style Guide

Best practices and coding patterns for Veda Client Framework.

## Table of Contents

- [Component Patterns](#component-patterns)
- [Reactivity Patterns](#reactivity-patterns)
- [When to Use What](#when-to-use-what)
- [Naming Conventions](#naming-conventions)
- [Performance Patterns](#performance-patterns)

---

## Component Patterns

### Direct Access vs Getters

**Use direct access** for simple property forwarding:

```javascript
// ✅ Good - direct access in template
class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({
      todos: []
    });
  }

  render() {
    return html`
      <${Loop} items="{this.state.todos}" item-key="id">
        <li>{this.model.text}</li>
      </${Loop}>
    `;
  }
}
```

**Use getters** when you need computation or logic:

```javascript
// ✅ Good - getter for computed logic
class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({
      todos: [],
      filter: 'all'
    });
  }

  get filteredTodos() {
    if (this.state.filter === 'active') {
      return this.state.todos.filter(t => !t.done);
    }
    if (this.state.filter === 'completed') {
      return this.state.todos.filter(t => t.done);
    }
    return this.state.todos;
  }

  render() {
    return html`
      <${Loop} items="{this.filteredTodos}" item-key="id">
        <li>{this.model.text}</li>
      </${Loop}>
    `;
  }
}
```

**Avoid** unnecessary getters that just forward properties:

```javascript
// ❌ Bad - unnecessary getter
get todos() {
  return this.state.todos; // Just use this.state.todos directly!
}
```

---

## Reactivity Patterns

### watch() vs effect()

**Use watch()** when you need old/new values or reference equality checking:

```javascript
// ✅ Good - need old/new values
this.watch(
  () => this.state.count,
  (newVal, oldVal) => {
    console.log(`Count changed from ${oldVal} to ${newVal}`);
    this.analytics.track('count_changed', { from: oldVal, to: newVal });
  }
);

// ✅ Good - checking if array reference changed
this.watch(
  () => this.state.items,
  (newItems, oldItems) => {
    if (newItems !== oldItems) {
      this.saveToLocalStorage(newItems);
    }
  }
);
```

**Use effect()** for simpler automatic tracking with multiple dependencies:

```javascript
// ✅ Good - tracks multiple dependencies automatically
this.effect(() => {
  this.classList.toggle('completed', this.completed);
  this.classList.toggle('editing', this.state.editing);
  this.classList.toggle('has-errors', this.errors.length > 0);
});

// ✅ Good - side effect with complex logic
this.effect(() => {
  if (this.state.editing) {
    const input = this.querySelector('.edit');
    if (input) {
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    }
  }
});
```

**Avoid** watch() when you don't need old/new values:

```javascript
// ❌ Bad - watch() not needed here
this.watch(
  () => this.completed,
  (isCompleted) => {
    this.classList.toggle('completed', isCompleted);
  }
);

// ✅ Good - use effect() instead
this.effect(() => {
  this.classList.toggle('completed', this.completed);
});
```

### Immediate Option

**Use { immediate: true }** for initial setup that should run on mount:

```javascript
// ✅ Good - apply initial state immediately
this.watch(
  () => this.state.editing,
  (editing) => {
    this.classList.toggle('editing', editing);
  },
  { immediate: true } // Apply class on mount
);

// ✅ Good - initial focus setup
this.watch(
  () => this.state.autofocus,
  (shouldFocus) => {
    if (shouldFocus) {
      const input = this.querySelector('input');
      input?.focus();
    }
  },
  { immediate: true }
);
```

**Don't use { immediate: true }** if initial run is not needed:

```javascript
// ❌ Bad - logs unnecessary initial value
this.watch(
  () => this.state.count,
  (count) => {
    console.log('Count changed to:', count);
  },
  { immediate: true } // Will log initial value unnecessarily
);

// ✅ Good - only logs changes
this.watch(
  () => this.state.count,
  (count) => {
    console.log('Count changed to:', count);
  }
);
```

---

## When to Use What

### Reactive State vs Plain State

**Use reactive state** (`this.reactive()`) when:
- Component has local state that changes
- State changes should trigger UI updates
- Working with reactive models

```javascript
// ✅ Good - component with changing state
class TodoItem extends Component(HTMLLIElement) {
  constructor() {
    super();
    this.state = this.reactive({
      editing: false,
      hovered: false
    });
  }
}
```

**Use plain state** when:
- Component has no local state
- State is purely for internal tracking (no UI impact)
- Simple presentational components

```javascript
// ✅ Good - no local state needed
class StaticHeader extends Component(HTMLElement) {
  constructor() {
    super();
    // No state needed
  }

  render() {
    return html`<h1>Todo App</h1>`;
  }
}
```

### Loop vs Manual Rendering

**Use Loop component** for:
- Dynamic lists with add/remove/reorder
- Lists with < 500 items
- When you need key-based reconciliation

```javascript
// ✅ Good - dynamic list
<${Loop} items="{this.state.todos}" item-key="id">
  <todo-item></todo-item>
</${Loop}>
```

**Use manual rendering** for:
- Static lists (known at build time)
- Very large lists (> 1000 items, use virtualization)
- Complex custom reconciliation logic

```javascript
// ✅ Good - static navigation
render() {
  return html`
    <nav>
      <a href="#/">Home</a>
      <a href="#/about">About</a>
      <a href="#/contact">Contact</a>
    </nav>
  `;
}
```

### Expressions vs Computed Properties

**Use expressions** for:
- Simple property access
- Direct value display

```javascript
// ✅ Good - simple access
<div>{this.state.count}</div>
<span>{this.user.name}</span>
<li>{this.model.v-s:title.0}</li>
```

**Use computed properties** for:
- Any logic beyond property access
- Formatting, calculations, conditionals

```javascript
// ❌ Bad - won't work (no operators in expressions)
<div>{this.count + 1}</div>

// ✅ Good - use getter
get incrementedCount() {
  return this.count + 1;
}
<div>{this.incrementedCount}</div>

// ❌ Bad - won't work (no ternary in expressions)
<span>{this.active ? 'Yes' : 'No'}</span>

// ✅ Good - use getter
get statusText() {
  return this.active ? 'Yes' : 'No';
}
<span>{this.statusText}</span>
```

---

## Naming Conventions

### Component Names

**Use PascalCase** for component classes:

```javascript
// ✅ Good
class TodoItem extends Component(HTMLLIElement) {}
class AppHeader extends Component(HTMLElement) {}
class UserProfile extends Component(HTMLElement) {}

// ❌ Bad
class todoItem extends Component(HTMLLIElement) {}
class app_header extends Component(HTMLElement) {}
```

**Use kebab-case** for custom element tags:

```javascript
// ✅ Good
static tag = 'todo-item';
static tag = 'app-header';
static tag = 'user-profile';

// ❌ Bad
static tag = 'TodoItem';
static tag = 'appHeader';
```

### State Properties

**Use descriptive names** for state properties:

```javascript
// ✅ Good
this.state = this.reactive({
  editing: false,
  loading: false,
  selectedId: null,
  filter: 'all'
});

// ❌ Bad
this.state = this.reactive({
  e: false,        // What is 'e'?
  l: false,        // What is 'l'?
  sel: null,       // Abbreviation unclear
  f: 'all'         // Single letter
});
```

### Event Handler Names

**Use handleXxx pattern** for event handlers:

```javascript
// ✅ Good
handleClick() { ... }
handleSubmit() { ... }
handleToggle() { ... }
handleEditKeyDown(event) { ... }

// ❌ Bad
click() { ... }       // Too generic
submit() { ... }      // Conflicts with HTML attribute
toggle() { ... }      // Unclear if it's handler or action
```

### Computed Properties

**Use noun phrases** for computed properties that return values:

```javascript
// ✅ Good
get filteredTodos() { ... }
get activeCount() { ... }
get completedItems() { ... }
get isEmpty() { ... }

// ❌ Bad
get filterTodos() { ... }   // Sounds like a method
get getActiveCount() { ... } // Don't prefix with 'get'
```

---

## Performance Patterns

### Array Mutations

**Always create new array references** for reactivity:

```javascript
// ❌ Bad - direct mutation not reactive (index assignment)
this.state.items[0] = newValue;

// ✅ Good - use splice
this.state.items.splice(0, 1, newValue);

// ✅ Good - or reassign
this.state.items = [...this.state.items];
this.state.items[0] = newValue;
this.state.items = this.state.items.slice();
```

**Use mutation methods** when possible (they are tracked):

```javascript
// ✅ Good - tracked mutations
this.state.items.push(newItem);
this.state.items.pop();
this.state.items.shift();
this.state.items.unshift(item);
this.state.items.splice(index, 1);
this.state.items.sort();
this.state.items.reverse();
```

### Watch Reference Equality

**Watch specific properties** instead of whole objects/arrays:

```javascript
// ❌ Bad - won't trigger on mutations
this.watch(() => this.state.items, callback);
this.state.items.push(x); // No trigger!

// ✅ Good - watch length
this.watch(() => this.state.items.length, callback);
this.state.items.push(x); // Triggers!

// ✅ Good - watch specific property
this.watch(() => this.state.user.name, callback);
```

### Batching Updates

**Group related state changes** (automatic batching via microtask):

```javascript
// ✅ Good - batched automatically
handleBulkUpdate() {
  this.state.count = 10;
  this.state.name = 'New';
  this.state.active = true;
  // Single render triggered via microtask
}

// No need to manually batch (framework handles it)
```

### Loop Performance

**Always provide item-key** for efficient reconciliation:

```javascript
// ❌ Bad - slow reconciliation
<${Loop} items="{this.items}">
  <div>{this.model.name}</div>
</${Loop}>

// ✅ Good - efficient key-based reconciliation
<${Loop} items="{this.items}" item-key="id">
  <div>{this.model.name}</div>
</${Loop}>
```

**Paginate large lists** (> 500 items):

```javascript
// ✅ Good - pagination
get currentPage() {
  const { page, pageSize } = this.state;
  return this.allItems.slice(
    page * pageSize,
    (page + 1) * pageSize
  );
}

<${Loop} items="{this.currentPage}" item-key="id">
  <item-card></item-card>
</${Loop}>
```

### Avoid Expensive Computations in Render

**Use getters** to cache computed values:

```javascript
// ❌ Bad - recalculates on every access
render() {
  const sorted = this.items.sort((a, b) => a.priority - b.priority);
  const filtered = sorted.filter(x => x.active);
  return html`
    <${Loop} items="${filtered}" item-key="id">...</${Loop}>
  `;
}

// ✅ Good - computed once, cached by reactivity
get activeItems() {
  return this.items
    .filter(x => x.active)
    .sort((a, b) => a.priority - b.priority);
}

render() {
  return html`
    <${Loop} items="{this.activeItems}" item-key="id">...</${Loop}>
  `;
}
```

---

## Common Pitfalls

### ❌ Don't Mutate Props

```javascript
// ❌ Bad
class TodoItem extends Component(HTMLLIElement) {
  handleToggle() {
    this.model.done = !this.model.done; // Mutating prop!
  }
}

// ✅ Good - emit event
class TodoItem extends Component(HTMLLIElement) {
  handleToggle() {
    this.dispatchEvent(new CustomEvent('toggle', {
      detail: { id: this.model.id },
      bubbles: true
    }));
  }
}
```

### ❌ Don't Call update() in Effects

```javascript
// ❌ Bad - infinite loop!
this.effect(() => {
  this.classList.toggle('active', this.state.active);
  await this.update(); // Triggers effect again!
});

// ✅ Good - effect automatically re-runs
this.effect(() => {
  this.classList.toggle('active', this.state.active);
  // No manual update needed
});
```

### ❌ Don't Create Reactive State in render()

```javascript
// ❌ Bad - creates new state on every render
render() {
  const localState = this.reactive({ count: 0 });
  return html`<div>{localState.count}</div>`;
}

// ✅ Good - create state in constructor
constructor() {
  super();
  this.state = this.reactive({ count: 0 });
}

render() {
  return html`<div>{this.state.count}</div>`;
}
```

---

## Summary

### Quick Reference

| Pattern | Use | Don't Use |
|---------|-----|-----------|
| Direct access | Simple property forwarding | Complex logic |
| Getter | Computed values, formatting | Simple forwarding |
| watch() | Need old/new values | Simple side effects |
| effect() | Multiple dependencies | When you need old/new |
| Loop | Dynamic lists < 500 items | Static lists, huge lists |
| Expression | Property access only | Logic, operators, functions |
| Reactive state | Changing component state | Static components |
| Plain state | No UI impact | State that drives UI |

### Decision Tree

**Should I use a getter?**
- Does it involve computation/logic? → **Yes, use getter**
- Is it just forwarding a property? → **No, use direct access**

**Should I use watch() or effect()?**
- Do I need old and new values? → **Use watch()**
- Is it a simple side effect? → **Use effect()**

**Should I use reactive state?**
- Does state change during lifecycle? → **Yes, use reactive()**
- Is component static? → **No, skip reactive state**

---

For more details, see:
- [API Reference](./API.md)
- [Reactivity Guide](./REACTIVITY.md)
- [Limitations](./LIMITATIONS.md)

