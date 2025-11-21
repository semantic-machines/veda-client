# Reactivity in Veda Client

Veda Client provides a fine-grained reactivity system inspired by Vue 3 and Solid.js. It allows automatic tracking of dependencies and automatic component updates.

## Overview

The reactivity system consists of three main parts:

1. **Reactive state** - Objects wrapped in a Proxy that track property access
2. **Effect system** - Automatically tracks dependencies and re-runs when they change
3. **Component reactivity** - Components have automatic reactive state via `this.state`

## Reactive Expressions

Use single braces `{expression}` in templates for reactive interpolation:

```javascript
import Component, { html } from 'veda-client';

export default class Counter extends Component(HTMLElement) {
  static tag = 'my-counter';

  constructor() {
    super();
    // State is automatically reactive
    this.state.count = 0;
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
  - `{this.state.model.v-s:title.0}`
  - `{this.user?.name}`
- ❌ Does NOT support: bracket notation, operators, function calls
  - `{this.state.model['v-s:title']}` - ❌ Wrong (use `{this.state.model.v-s:title}` instead)
  - `{this.items['key']}` - ❌ Wrong
  - `{this.count + 1}` - ❌ Wrong
  - `{this.format(date)}` - ❌ Wrong
- 💡 For complex logic: use computed properties (getters)

## Basic Usage

### Reactive Objects

Create reactive objects using the `reactive()` function:

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

**In components (current version), state is automatically reactive:**

```javascript
import Component from 'veda-client';

class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    // State is automatically reactive - just assign properties
    this.state.count = 0;
  }
}
```

**How it works:**
- `this.state` is automatically created as a reactive object
- Automatic effect cleanup and model integration

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

### Fine-Grained Array Reactivity

Array index assignment **IS reactive** when effects track specific indices:

```javascript
const state = reactive({ items: [1, 2, 3] });

// ✅ Effect tracks items[0] - will react to index 0 changes
effect(() => {
  console.log('First item:', state.items[0]);
});

state.items[0] = 99; // ✅ Triggers the effect!

// ❌ Effect only tracks length - won't react to index changes
effect(() => {
  console.log('Length:', state.items.length);
});

state.items[0] = 88; // ❌ Won't trigger (length unchanged)
state.items.push(4);  // ✅ Triggers (length changed)
```

**This is fine-grained reactivity** - effects only re-run when properties they actually read change.

**Array methods trigger all tracking:**
```javascript
// These methods trigger all effects tracking the array
state.items.push(4);      // Modifies multiple properties
state.items.splice(0, 1); // Modifies indices and length
state.items.sort();       // Modifies all indices
```

### Reactive Components

Component state is automatically reactive - no setup needed:

```javascript
import Component, { html } from 'veda-client';

export default class Counter extends Component(HTMLElement) {
  static tag = 'my-counter';

  constructor() {
    super();
    // State is automatically reactive - just assign
    this.state.count = 0;
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
    this.state.filter = 'all';
  }

  get todos() {
    return this.state.model['v-s:hasTodo'] || [];
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

### Computed Values and Priority

When using `computed()` from the framework, computed values automatically recalculate before regular effects:

```javascript
import { reactive, computed, effect } from 'veda-client';

const state = reactive({ count: 0 });

// This runs FIRST (computed priority)
const doubled = computed(() => state.count * 2);

// This runs SECOND (regular effect)
effect(() => {
  console.log('Doubled:', doubled.value);
});

state.count = 5;
// Execution order: computed recalculates → regular effects run
```

**Why this matters:** Ensures computed values are always up-to-date before dependent effects run, preventing stale values.

**Note:** Component getters (like `filteredTodos` above) don't have priority - use `computed()` if you need guaranteed ordering.

## Side Effects

You can use **either** `effect()` or `watch()` for side effects. Both are valid approaches with different strengths.

### Recommended: effect() - Automatic tracking

`effect()` is simpler for most use cases - it automatically tracks all dependencies:

```javascript
async connectedCallback() {
  await super.connectedCallback();

  // Simple effect for CSS class - runs when this.completed changes
  this.effect(() => {
    this.classList.toggle('completed', this.completed);
  });

  // Effect for editing state with side effects
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

  // Effect for toggle-all checkbox syncing
  this.effect(() => {
    const input = this.querySelector('#toggle-all');
    if (input) {
      input.checked = this.allCompleted;
    }
  });
}
```

### Alternative: watch() - When you need old/new values

`watch()` provides callbacks with old and new values:

```javascript
async connectedCallback() {
  await super.connectedCallback();

  // Watch with old/new values - useful for comparisons
  this.watch(
    () => this.completed,
    (isCompleted, wasCompleted) => {
      this.classList.toggle('completed', isCompleted);
      console.log(`Status changed from ${wasCompleted} to ${isCompleted}`);
    },
    { immediate: true } // Apply initial state on mount
  );

  // Watch for initial setup that should run on mount
  this.watch(
    () => this.state.editing,
    (editing) => {
      this.classList.toggle('editing', editing);

      if (editing) {
        const input = this.querySelector('.edit');
        if (input) {
          requestAnimationFrame(() => {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          });
        }
      }
    },
    { immediate: true } // Ensure initial editing state is applied
  );
}
```

**When to use which:**
- **Use `effect()`** for most side effects - simpler, automatic tracking
- **Use `watch()`** when you need old/new value comparison
- **Use `watch()` with `{ immediate: true }`** for initial setup on mount
- Both auto-cleanup on component disconnect

**Note:** The TodoMVC examples (`app-todo/`) demonstrate **both approaches**:
- **TodoItem** uses `watch()` with `{ immediate: true }` for CSS classes
- **TodoApp** uses `effect()` for checkbox syncing
- Both are equally valid - choose based on your needs

**When to use `{ immediate: true }`:**
- Applying initial CSS classes based on state
- Setting up initial focus or scroll position
- Synchronizing initial component state with DOM
- Any side effect that should run both on mount and on changes

**Example - with vs without immediate:**
```javascript
// ❌ Without immediate - class only added when editing changes
this.watch(() => this.state.editing, (editing) => {
  this.classList.toggle('editing', editing);
});
// If editing is true on mount, class won't be added until it changes

// ✅ With immediate - class added immediately if editing is true
this.watch(
  () => this.state.editing,
  (editing) => {
    this.classList.toggle('editing', editing);
  },
  { immediate: true }
);
// Class added correctly on mount based on initial state
```

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
    this.state.editing = false; // Automatically reactive in v3.0
  }

  get title() {
    return this.state.model?.['v-s:title']?.[0] || '';
  }

  async handleSave() {
    // Save model
    this.state.model['v-s:title'] = ['New title'];
    await this.state.model.save();

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
    this.state.editing = false; // Automatically reactive in v3.0
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

- Component state is automatically reactive - just use `this.state`
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

- **`TodoItem.js`** - Uses `watch()` with `{ immediate: true }` for CSS class management and focus handling
- **`TodoApp.js`** - Uses `effect()` for toggle-all checkbox syncing (simpler, no old/new values needed)
- **`TodoFooter.js`** - Computed properties for reactive attributes (no explicit effects)

**Key Takeaway:** The TodoMVC examples demonstrate **both `effect()` and `watch()`** to show different approaches. Use what fits your use case best.

## API Reference

### `reactive(obj)`

Creates a reactive object from a plain object.

**Parameters:**
- `obj` - Object to make reactive

**Returns:** Reactive object

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
- `reactive(obj)` - Create reactive objects

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

### Effect Batching Explained

Multiple state changes automatically batch into a single update via microtask:

```javascript
// These three changes trigger only ONE effect execution
this.state.count = 1;
this.state.name = 'Jane';
this.state.active = true;
// Microtask → flushEffects() → single DOM update
```

**Benefits:**
- ✅ Prevents multiple unnecessary DOM updates
- ✅ Better performance for rapid state changes
- ✅ Automatic - no manual optimization needed

**How it works:**
1. First state change queues effect in microtask
2. Additional changes reuse the same microtask
3. All effects run once when microtask executes

**Implementation:** Uses `queueMicrotask()` internally (see `src/Effect.js` lines 35-40)

**Example - Without Batching:**
```javascript
// If effects ran immediately:
state.a = 1;  // Effect runs → DOM update
state.b = 2;  // Effect runs → DOM update
state.c = 3;  // Effect runs → DOM update
// Total: 3 DOM updates ❌
```

**Example - With Batching (actual behavior):**
```javascript
state.a = 1;  // Queued
state.b = 2;  // Queued (reuses microtask)
state.c = 3;  // Queued (reuses microtask)
// Microtask executes → 1 DOM update ✅
```

## Advanced Topics

### Infinite Loop Detection

The framework automatically detects and prevents infinite loops when effects modify their own dependencies:

```javascript
import { reactive, effect } from 'veda-client';

const state = reactive({ count: 0 });

// ❌ DANGER - effect modifies what it reads
effect(() => {
  state.count++;  // Reads AND writes state.count
});
// After 100 iterations: Error thrown with helpful message
```

**Error message:**
```
Infinite loop detected: Effect triggered 100 times in a single update cycle.
This usually means an effect is modifying state it depends on.
```

**Limit:** MAX_TRIGGER_COUNT = 100 (configurable in `src/Effect.js` line 15)

**Why 100?** Catches most infinite loops while allowing legitimate cascading updates (e.g., state → computed → derived state).

**Correct pattern:**
```javascript
// ✅ SAFE - effect only reads, doesn't modify dependencies
effect(() => {
  console.log('Count:', state.count);  // Read only
});

// Modify state elsewhere
function increment() {
  state.count++;  // Separate from effect
}
```

**Legitimate cascading updates:**
```javascript
const state = reactive({
  price: 100,
  quantity: 2,
  total: 0
});

// ✅ SAFE - cascading but terminates
effect(() => {
  state.total = state.price * state.quantity;
  // Reads price, quantity → writes total
  // Only triggers once per price/quantity change
});
```

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

