# Reactivity in Veda Client

Veda Client provides a fine-grained reactivity system inspired by Vue 3 and Solid.js. It allows automatic tracking of dependencies and automatic component updates.

## Overview

The reactivity system consists of three main parts:

1. **Reactive state** - Objects wrapped in a Proxy that track property access
2. **Effect system** - Automatically tracks dependencies and re-runs when they change
3. **Component with reactivity** - Components automatically become reactive when using `reactive()` state

## Reactive Expressions

Use single braces `{expression}` in templates for reactive interpolation:

```javascript
import Component, { html } from 'veda-client';

export default class Counter extends Component(HTMLElement) {
  static tag = 'my-counter';

  constructor() {
    super();
    this.state = this.reactive({
      count: 0
    });
  }

  increment() {
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
```

**Key features:**
- Text nodes with `{expression}` update automatically
- Attributes with `{expression}` update automatically
- Event handlers use `{methodName}` syntax
- Only the specific text node or attribute updates (minimal DOM changes)

**Expression syntax:**
- ✅ Supports: dot notation with optional chaining
  - `{this.state.count}`
  - `{this.model.v-s:title.0}`
  - `{this.user?.name}`
- ❌ Does NOT support: bracket notation, operators, function calls
  - `{this.model['v-s:title']}` - ❌ Wrong (use `{this.model.v-s:title}` instead)
  - `{this.items['key']}` - ❌ Wrong
  - `{this.count + 1}` - ❌ Wrong
  - `{this.format(date)}` - ❌ Wrong
- 💡 For complex logic: use computed properties (getters)

## Basic Usage

### Reactive State

Create reactive state using the `reactive()` function:

```javascript
import { reactive } from 'veda-client';

// Outside components - use global reactive()
const state = reactive({
  count: 0,
  name: 'John'
});

// Changes trigger effects automatically
state.count++; // Triggers all effects that depend on count
```

**In components, use `this.reactive()`:**

```javascript
import Component from 'veda-client';

class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    // Use this.reactive() instead of reactive()
    this.state = this.reactive({ count: 0 });
  }
}
```

**Why `this.reactive()`?**
- It calls the global `reactive()` function
- **And** sets an internal flag that enables reactivity features
- This is required for automatic effect cleanup and model integration

### Array Mutations

Reactive arrays support all standard mutation methods:

```javascript
const state = reactive({
  items: [1, 2, 3]
});

// All these mutations trigger reactivity automatically
state.items.push(4);        // Add to end
state.items.pop();          // Remove from end
state.items.shift();        // Remove from start
state.items.unshift(0);     // Add to start
state.items.splice(1, 1);   // Remove/replace
state.items.sort();         // Sort in place
state.items.reverse();      // Reverse in place

// Array replacement also works
state.items = [5, 6, 7];
```

### Reactive Components

Use `this.reactive()` to create reactive state - Component automatically detects it and enables reactivity:

```javascript
import Component, { html } from 'veda-client';

export default class Counter extends Component(HTMLElement) {
  static tag = 'my-counter';

  constructor() {
    super();
    this.state = this.reactive({
      count: 0
    });
  }

  increment() {
    // Just update state - DOM updates automatically
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
```

## Computed Properties

Use getters to create computed properties that automatically recalculate:

```javascript
export default class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({
      filter: 'all'
    });
  }

  get todos() {
    return this.model['v-s:hasTodo'] || [];
  }

  // Automatically recalculates when todos or filter changes
  get filteredTodos() {
    if (this.state.filter === 'active') {
      return this.todos.filter(t => !t.completed);
    }
    if (this.state.filter === 'completed') {
      return this.todos.filter(t => t.completed);
    }
    return this.todos;
  }

  render() {
    return html`
      <ul>
        ${this.filteredTodos.map(todo => html`
          <li>{todo.title}</li>
        `)}
      </ul>
    `;
  }
}
```

## Side Effects

You can use **either** `watch()` or `effect()` for side effects:

### Using watch() - Callback-based

`watch()` provides a callback with new and old values:

```javascript
async connectedCallback() {
  await super.connectedCallback();

  // Watch a computed property
  this.watch(() => this.completed, (isCompleted) => {
    this.classList.toggle('completed', isCompleted);
  });

  // Watch state
  this.watch(() => this.state.editing, (editing) => {
    if (editing) {
      this.querySelector('.edit-input')?.focus();
    }
  });
}
```

### Using effect() - Direct tracking

`effect()` tracks dependencies automatically - simpler for complex logic:

```javascript
async connectedCallback() {
  await super.connectedCallback();

  // Effect tracks this.completed automatically
  this.effect(() => {
    this.classList.toggle('completed', this.completed);
  });

  // Effect for editing state and focus
  this.effect(() => {
    this.classList.toggle('editing', this.state.editing);

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
}
```

**When to use which:**
- Use `watch()` when you need old/new values or want reference equality checks
- Use `effect()` for simpler code when tracking multiple dependencies
- Both auto-cleanup on component disconnect

### ⚠️ Important: Reference Equality

`watch()` uses **reference equality (===)** for comparison:

```javascript
state = reactive({ items: [1, 2, 3] });

// ❌ Won't trigger - same array reference
this.watch(() => state.items, (val) => console.log('changed'));
state.items.push(4);  // No trigger!

// ✅ Triggers - new array reference
state.items = [...state.items, 4];  // Triggers!

// ✅ Alternative: watch array length
this.watch(() => state.items.length, (len) => console.log('length:', len));
state.items.push(5);  // Triggers! (length changed)
```

**For objects/arrays:**
- Changes to properties inside won't trigger
- Only reassigning the whole object/array will trigger
- To watch deep changes, watch specific properties or use `effect()` directly

## Using Effect for Complex Logic

Use `effect()` for more complex reactive logic where automatic tracking is easier:

```javascript
async connectedCallback() {
  await super.connectedCallback();

  // Effect runs immediately and whenever dependencies change
  this.effect(() => {
    const input = this.querySelector('#toggle-all');
    if (input) {
      input.checked = this.allCompleted;
    }
  });
}
```

## Model Integration

Models automatically trigger updates when component uses reactive state:

```javascript
export default class TodoItem extends Component(HTMLLIElement) {
  constructor() {
    super();
    this.state = this.reactive({ editing: false }); // Enables reactivity
  }

  get title() {
    return this.model?.['v-s:title']?.[0] || '';
  }

  async handleSave() {
    // Save model
    this.model['v-s:title'] = ['New title'];
    await this.model.save();

    // NO NEED to call this.update() - reactivity handles it
  }

  render() {
    // This text automatically updates when model changes
    return html`<label>{this.title}</label>`;
  }
}
```

## How It Works

### Dependency Tracking

During the first render, the system tracks which properties are accessed in the template:

1. Template reads `this.state.count`
2. System records: "this text node depends on state.count"
3. When `state.count` changes, only that text node is updated

### Fine-Grained Updates

Instead of re-rendering the entire component:

- Text nodes update individually
- Attributes update individually
- Conditional sections show/hide
- Lists add/remove items efficiently

### Batching

Multiple changes are automatically batched into a single update:

```javascript
// These three changes trigger only one DOM update
this.state.count = 1;
this.state.name = 'Jane';
this.state.active = true;
```

## Performance

The reactivity system is designed for minimal DOM updates:

- ✅ Only changed text nodes are updated
- ✅ Only changed attributes are updated
- ✅ Changes are batched via microtask
- ✅ No virtual DOM diffing overhead
- ✅ Direct DOM manipulation for maximum speed

## When to Use Reactivity

**Use reactive state (`reactive()`) for:**
- Components with local state (flags, counters, form fields)
- Components that need automatic updates on state changes
- Components working with reactive models
- Example: TodoItem with editing state

**Use plain state (without `reactive()`) for:**
- Components without local state
- Components that manually control re-rendering
- Simple presentational components
- Example: Static headers, pure display components

## Enabling Reactivity

Reactivity is **opt-in** - just wrap your state in `reactive()`:

### Non-reactive (manual updates):

```javascript
export default class TodoItem extends Component(HTMLLIElement) {
  constructor() {
    super();
    this.editing = false; // Plain property
  }

  async handleEdit() {
    this.editing = true;
    await this.update(); // Manual re-render
  }
}
```

### Reactive (automatic updates):

```javascript
export default class TodoItem extends Component(HTMLLIElement) {
  constructor() {
    super();
    this.state = this.reactive({ editing: false }); // ← Enables reactivity!
  }

  async connectedCallback() {
    await super.connectedCallback();

    // Watch for changes and apply side effects
    this.watch(() => this.state.editing, (editing) => {
      this.classList.toggle('editing', editing);
    }, { immediate: true });
  }

  handleEdit() {
    // Just update state - watch handlers run automatically
    this.state.editing = true;
  }
}
```

## Best Practices

### ✅ DO

- Use `this.reactive()` in components for automatic reactivity
- Use global `reactive()` only outside components
- Use getters for computed properties
- Use `effect()` for side effects that track multiple dependencies
- Use `watch()` for side effects where you need old/new value comparison
- Keep render() pure - no side effects
- Use plain properties when manual control is needed

### ❌ DON'T

- Don't create reactive objects inside render()
- Don't call `update()` inside watch handlers (causes infinite loops)
- Don't forget `{ immediate: true }` when you need initial setup

## Examples

See the TodoMVC implementation in `app-todo/` for complete examples:

- `TodoItem.js` - Local state, computed properties, effects for classList updates
- `TodoApp.js` - Complex state, model integration, list rendering with Loop
- `TodoFooter.js` - Reactive attributes

**Note:** The real TodoMVC examples use `effect()` for side effects. Both `effect()` and `watch()` are valid - choose based on your needs.

## API Reference

### `reactive(obj)`

Creates a reactive proxy of an object.

**Parameters:**
- `obj` - Object to make reactive

**Returns:** Reactive proxy

### `effect(fn, options?)`

Creates an effect that tracks dependencies and re-runs when they change.

**Parameters:**
- `fn` - Function to run
- `options.lazy` - Don't run immediately

**Returns:** Cleanup function

### `ReactiveComponent(ElementClass, ModelClass?)`

Creates a reactive component class.

**Methods:**
- `watch(getter, callback)` - Watch a value
- `effect(fn)` - Create an effect
- `reactive(obj)` - Create reactive state

## Architecture

### How It Works

1. **Detection**: Component constructor checks if `this.state` is reactive
2. **Subscription**: If reactive, component subscribes to model changes
3. **Batching**: Multiple changes batch into one update via microtask
4. **Effects**: Watch handlers run when their dependencies change

### When Updates Happen

**With reactive state:**
- Model changes → automatic `update()`
- State changes → watch handlers run
- Manual `update()` still works for structural changes (lists)

**Without reactive state:**
- Only manual `update()` calls
- Standard Component behavior

## Advanced Topics

### Custom Effects

Create custom reactive behavior:

```javascript
// Debounced effect
const debouncedEffect = (fn, delay) => {
  let timeout;
  return effect(() => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
  });
};
```

### Untrack

Prevent tracking in part of an effect:

```javascript
import { untrack } from 'veda-client';

this.effect(() => {
  const count = this.state.count; // Tracked

  untrack(() => {
    const other = this.state.other; // Not tracked
  });
});
```

### Manual Trigger

Manually trigger updates (rarely needed):

```javascript
import { trigger } from 'veda-client';

trigger(this.state, 'count');
```

