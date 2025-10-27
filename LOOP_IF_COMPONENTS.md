# Loop & If Components

Реактивные компоненты для списков и условного рендеринга.

---

## `<veda-loop>` - Reactive Lists with Reconciliation

### Features

- ✅ **Reconciliation** - только changed items обновляются
- ✅ **Key-based** - intelligent DOM reuse
- ✅ **Reactive** - автоматически обновляется при изменении items
- ✅ **Performance** - минимум DOM operations

### Basic Usage

```html
<veda-loop items="{this.todos}" item-key="id">
  <template>
    <todo-item></todo-item>
  </template>
</veda-loop>
```

### Attributes

- **`items`** (required) - Expression that returns an array
- **`item-key`** (optional) - Property name to use as key (default: `"id"`)

### How Reconciliation Works

```javascript
// Initial render: 3 items
state.items = [
  { id: 1, title: 'A' },
  { id: 2, title: 'B' },
  { id: 3, title: 'C' }
];
// → Creates 3 DOM elements

// Add item
state.items.push({ id: 4, title: 'D' });
// → Creates 1 new DOM element (only #4)
// → Reuses existing elements #1, #2, #3

// Remove item
state.items = state.items.filter(i => i.id !== 2);
// → Removes 1 DOM element (#2)
// → Keeps existing elements #1, #3

// Reorder
state.items = [items[2], items[0], items[1]];
// → Moves existing DOM elements
// → No re-creation!
```

### Examples

**Simple list:**
```javascript
class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = reactive({
      todos: [
        { id: 1, title: 'Buy milk' },
        { id: 2, title: 'Walk dog' }
      ]
    });
  }

  render() {
    return html`
      <veda-loop items="{this.state.todos}" item-key="id">
        <template>
          <todo-item></todo-item>
        </template>
      </veda-loop>
    `;
  }
}
```

**With filtering:**
```javascript
get filteredTodos() {
  return this.state.todos.filter(t => {
    if (this.state.filter === 'active') return !t.completed;
    if (this.state.filter === 'completed') return t.completed;
    return true;
  });
}

render() {
  return html`
    <veda-loop items="{this.filteredTodos}" item-key="id">
      <todo-item></todo-item>
    </veda-loop>
  `;
}
```

**Without template tag (inline):**
```html
<veda-loop items="{this.items}" item-key="id">
  <div class="item">...</div>
</veda-loop>
```

### Item Component Access

Items are automatically set as `model` on child components:

```javascript
class TodoItem extends Component(HTMLElement) {
  render() {
    // this.model is the current item
    return html`
      <div>{this.model.title}</div>
    `;
  }
}
```

---

## `<veda-if>` - Conditional Rendering

### Features

- ✅ **True conditional** - content не существует в DOM when hidden
- ✅ **Reactive** - автоматически показывает/скрывает
- ✅ **Template support** - можно использовать `<template>`
- ✅ **Clean DOM** - только comment node when hidden

### Basic Usage

```html
<veda-if condition="{this.showDetails}">
  <div>Details content</div>
</veda-if>
```

### Attributes

- **`condition`** (required) - Expression that returns boolean

### How It Works

```javascript
// When condition is true:
<veda-if>
  <div>Content</div>  <!-- Content exists in DOM -->
</veda-if>

// When condition is false:
<veda-if>
  <!--veda-if-->  <!-- Only placeholder comment -->
</veda-if>
```

### Examples

**Simple show/hide:**
```javascript
class UserProfile extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = reactive({
      isLoggedIn: false
    });
  }

  render() {
    return html`
      <veda-if condition="{this.state.isLoggedIn}">
        <div class="profile">
          Welcome back!
        </div>
      </veda-if>

      <veda-if condition="{!this.state.isLoggedIn}">
        <div class="login">
          Please log in
        </div>
      </veda-if>
    `;
  }
}
```

**With template tag:**
```html
<veda-if condition="{this.hasItems}">
  <template>
    <expensive-component></expensive-component>
  </template>
</veda-if>
```

**Nested conditions:**
```html
<veda-if condition="{this.user}">
  <div class="user-info">
    <veda-if condition="{this.user.isPremium}">
      <span class="badge">Premium</span>
    </veda-if>
  </div>
</veda-if>
```

---

## Combined Usage: Loop + If

```javascript
class TodoApp extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = reactive({
      filter: 'all',
      todos: []
    });
  }

  get filteredTodos() {
    // Computed property
    if (this.state.filter === 'active') {
      return this.state.todos.filter(t => !t.completed);
    }
    if (this.state.filter === 'completed') {
      return this.state.todos.filter(t => t.completed);
    }
    return this.state.todos;
  }

  get hasItems() {
    return this.state.todos.length > 0;
  }

  get hasCompletedItems() {
    return this.state.todos.some(t => t.completed);
  }

  render() {
    return html`
      <!-- Show list only if there are items -->
      <veda-if condition="{this.hasItems}">
        <veda-loop items="{this.filteredTodos}" item-key="id">
          <template>
            <todo-item></todo-item>
          </template>
        </veda-loop>
      </veda-if>

      <!-- Show empty state if no items -->
      <veda-if condition="{!this.hasItems}">
        <p class="empty">No todos yet</p>
      </veda-if>

      <!-- Show clear button only if there are completed items -->
      <veda-if condition="{this.hasCompletedItems}">
        <button onclick="{clearCompleted}">Clear Completed</button>
      </veda-if>
    `;
  }
}
```

---

## Performance Comparison

### Without Loop Component (manual render):

```javascript
// ПЛОХО: Full re-render on every change
render() {
  return html`
    <ul>
      ${this.items.map(item => html`
        <li about="${item.id}"><todo-item></todo-item></li>
      `)}
    </ul>
  `;
}

// Change 1 item → ALL items unmount → ALL items re-mount
```

**Problems:**
- ❌ All items destroyed and recreated
- ❌ All connectedCallback() run
- ❌ All effects recreated
- ❌ Slow on large lists
- ❌ Lose component state (scroll position, focus, etc)

### With Loop Component (reconciliation):

```javascript
// ХОРОШО: Intelligent reconciliation
render() {
  return html`
    <veda-loop items="{this.items}" item-key="id">
      <todo-item></todo-item>
    </veda-loop>
  `;
}

// Change 1 item → Only that item updates
```

**Benefits:**
- ✅ Only changed items update
- ✅ Existing DOM elements reused
- ✅ Component state preserved
- ✅ Fast on any size list
- ✅ Smooth user experience

---

## Best Practices

### ✅ DO

**Use unique keys:**
```html
<!-- GOOD: stable key -->
<veda-loop items="{this.todos}" item-key="id">
```

**Computed properties for filtering:**
```javascript
get filteredItems() {
  return this.state.items.filter(...);
}

render() {
  return html`
    <veda-loop items="{this.filteredItems}" item-key="id">
  `;
}
```

**Conditional rendering for expensive components:**
```html
<veda-if condition="{this.showChart}">
  <expensive-chart-component></expensive-chart-component>
</veda-if>
```

### ❌ DON'T

**Don't use index as key:**
```html
<!-- BAD: index changes on reorder -->
<veda-loop items="{this.todos}" item-key="index">
```

**Don't compute in template:**
```html
<!-- BAD: recomputes on every render -->
<veda-loop items="{this.todos.filter(t => !t.done)}">
```

**Don't nest loops deeply:**
```html
<!-- BAD: performance issues -->
<veda-loop items="{this.categories}">
  <veda-loop items="{category.products}">
    <veda-loop items="{product.variants}">
      <!-- Too deep! -->
    </veda-loop>
  </veda-loop>
</veda-loop>
```

---

## Migration from Manual Rendering

### Before (manual):

```javascript
class TodoApp extends Component(HTMLElement) {
  async handleNewTodo(todo) {
    this.model.addValue('v-s:hasTodo', todo);
    await this.model.save();
    this.update(); // Manual re-render ALL todos
  }

  render() {
    return html`
      <ul>
        ${this.todos.map(todo => html`
          <li about="${todo.id}"></li>
        `)}
      </ul>
    `;
  }
}
```

### After (with Loop):

```javascript
class TodoApp extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = reactive({
      todos: []
    });
  }

  async handleNewTodo(todo) {
    // Just modify reactive array
    this.state.todos.push(todo);
    await todo.save();
    // No manual update() needed!
  }

  render() {
    return html`
      <veda-loop items="{this.state.todos}" item-key="id">
        <template>
          <todo-item></todo-item>
        </template>
      </veda-loop>
    `;
  }
}
```

**Benefits:**
- ✅ No manual `update()` calls
- ✅ Only new item renders
- ✅ Cleaner code
- ✅ Better performance

---

## Technical Details

### Loop Reconciliation Algorithm

1. **Build maps** of old and new items by key
2. **Remove** items that are no longer in new list
3. **Add** items that are new
4. **Reorder** items if position changed
5. **Update** items if data changed (via `model` property)

### If Component Behavior

1. **On show**: Clone template → process → insert into DOM
2. **On hide**: Remove content → insert comment placeholder
3. **Reactive**: Effect tracks condition expression

### Memory Management

- ✅ Effects cleanup on disconnectedCallback
- ✅ No memory leaks
- ✅ Proper component lifecycle

---

## Examples

See `examples/loop-if-demo.html` for interactive demos.

