# API Reference

Complete API documentation for Veda Client Framework.

---

## Terminology Glossary

Understanding key terms used throughout this documentation:

**Reactive Proxy:**
The Proxy object returned by `reactive()` that wraps your data and enables automatic dependency tracking. This is the low-level mechanism.

```javascript
const proxy = reactive({ count: 0 });
console.log(proxy.__isReactive); // true
```

**Reactive State:**
Component state that is automatically reactive. `this.state` is created automatically by the Component base class.

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    // this.state is automatically reactive!
    this.state.count = 0;
  }
}
```

**Reactive Object:**
Any object wrapped with `reactive()`, whether in a component or standalone. Generic term for reactive data.

```javascript
// Standalone reactive object (not in component)
const store = reactive({ users: [] });
```

**Usage Guidelines:**
- **"Reactive proxy"** - when discussing the technical Proxy wrapper
- **"Reactive state"** - when referring to component state (`this.state`)
- **"Reactive object"** - when referring to standalone reactive data or generic reactive objects

---

## Table of Contents

- [Component](#component)
  - [Automatic State](#automatic-state)
  - [Property Binding](#property-binding)
- [Reactivity](#reactivity)
- [Reactivity Edge Cases](#reactivity-edge-cases)
- [Built-in Components](#built-in-components)
  - [Loop](#loop)
  - [If](#if)
  - [Property](#property)
  - [Relation](#relation)
- [Advanced Components](#advanced-components)
- [Model](#model)
- [Backend](#backend)
- [Subscription](#subscription)
- [Router](#router)
- [Utility Functions](#utility-functions)
- [Value](#value)
- [WeakCache](#weakcache)
- [Emitter](#emitter)
- [BackendError](#backenderror)
- [TypeScript](#typescript)

---

## Component

Base class for creating reactive Web Components.

### Usage

```javascript
import Component, { html } from 'veda-client';

class MyComponent extends Component(HTMLElement) {
  static tag = 'my-component';

  constructor() {
    super();
    // State is automatically reactive!
    this.state.count = 0;
  }

  render() {
    return html`<div>{this.state.count}</div>`;
  }
}

customElements.define(MyComponent.tag, MyComponent);
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `Reactive<Object>` | Automatically reactive state object |
| `template` | `string` | Rendered HTML template |
| `rendered` | `Promise<void>` | Resolves when component is rendered |

### Automatic State

Every component automatically has a reactive `state` object:

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();

    // Just set properties directly
    this.state.count = 0;
    this.state.items = [];
    this.state.user = null;
  }
}
```

**Model integration:**

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    // Model is part of state
    this.state.model = new Model('d:MyEntity');
  }

  render() {
    return html`<div>{this.state.model.title}</div>`;
  }
}
```

**Automatic `about` attribute:**

```html
<my-component about="d:MyEntity"></my-component>
```

```javascript
class MyComponent extends Component(HTMLElement) {
  async connectedCallback() {
    super.connectedCallback();
    // this.state.model is automatically created and loaded!
    console.log(this.state.model.id); // 'd:MyEntity'
  }
}
```

### Property Binding

Pass complex data using `:` prefix:

#### Syntax

- **Without `:`** → String attribute: `class="active"`
- **With `:`** → Property to state: `:user="{this.state.currentUser}"`

#### Examples

**Passing objects:**

```javascript
// Parent component
class UserList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state.users = [
      { id: 1, name: 'Alice' }
    ];
  }

  render() {
    return html`
      <${Loop} items="{this.state.users}" as="user" key="id">
        <user-card :user="{user}"></user-card>
      </${Loop}>
    `;
  }
}

// Child component
class UserCard extends Component(HTMLElement) {
  render() {
    // Access via this.state
    return html`
      <div>{this.state.user.name}</div>
    `;
  }
}
```

**Type handling:**

```html
<!-- Strings (no prefix) -->
<my-component class="active" data-id="123"></my-component>

<!-- Objects, arrays, numbers (with :) -->
<my-component
  :user="{this.state.currentUser}"
  :items="{this.state.todos}"
  :count="{this.state.total}">
</my-component>
```

**Native elements:**

```html
<!-- : prefix sets DOM properties -->
<input :value="{this.state.text}">
<button :disabled="{this.state.isLoading}">Submit</button>
```

### Lifecycle Methods

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    // Initialize state
  }

  async added() {
    // Called before first render
  }

  async pre() {
    // Called before each render
  }

  render() {
    // Return HTML template
    return html`<div>Content</div>`;
  }

  async post() {
    // Called after each render
  }

  async removed() {
    // Called after disconnection
  }

  async connectedCallback() {
    // Component added to DOM
    await super.connectedCallback();
  }

  disconnectedCallback() {
    // Component removed from DOM
    super.disconnectedCallback();
  }

  renderedCallback() {
    // Called after rendering completes
  }
}
```

### Reactive Methods

#### `watch<T>(getter, callback, options?): () => void`

Watches reactive value changes and runs callback when value changes.

**Note:** `watch()` is a Component method, available only within component classes via `this.watch()`.

**Parameters:**
- `getter: () => T` - Function that returns the value to watch
- `callback: (newValue: T, oldValue: T | undefined) => void` - Called when value changes
- `options?: { immediate?: boolean }` - Optional configuration
  - `immediate: boolean` - If true, runs callback immediately with current value (default: false)

**Returns:** Cleanup function to stop watching

**Important:** Uses strict equality (===) for comparison. Array/object mutations won't trigger unless reference changes.

**Note on immediate option:** When `immediate: true`, the callback runs synchronously during effect setup. On the first call, `oldValue` will equal `newValue` since there's no previous value yet.

**Examples:**

```javascript
// Note: watch() is a Component method, use within component class

class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    this.state.count = 0;
    this.state.editing = false;
    this.state.items = [];
    this.state.active = true;
  }

  async connectedCallback() {
    await super.connectedCallback();

    // Basic usage
    this.watch(
      () => this.state.count,
      (newValue, oldValue) => {
        console.log(`Count changed from ${oldValue} to ${newValue}`);
      }
    );

    // With immediate option - runs callback immediately with current value
    this.watch(
      () => this.state.editing,
      (editing) => {
        this.classList.toggle('editing', editing);
      },
      { immediate: true }
    );

    // Initial setup example - apply CSS class on mount
    this.watch(
      () => this.state.active,
      (isActive) => {
        this.classList.toggle('active', isActive);
      },
      { immediate: true } // ← Critical! Without this, class won't be set on mount
    );

    // Watching array length (not array itself)
    this.watch(
      () => this.state.items.length,
      (length) => console.log('Items count:', length)
    );

    // Manual cleanup
    const stopWatching = this.watch(
      () => this.state.active,
      (active) => console.log('Active:', active)
    );

    // Later...
    stopWatching(); // Stop watching
  }
}
```

**Notes:**
- Cleanup is automatic on component disconnect
- Uses reference equality - see section below for details
- Returns cleanup function for manual control

**Common pitfalls:**

```javascript
// ❌ Won't trigger - same array reference
this.watch(() => state.items, callback);
state.items.push(4);  // No trigger!

// ✅ Triggers - new array reference
state.items = [...state.items, 4];

// ✅ Alternative - watch array length
this.watch(() => state.items.length, callback);
```

**When to use `{ immediate: true }`:**

```javascript
// ❌ Without immediate - initial state not applied
this.watch(
  () => this.state.editing,
  (editing) => this.classList.toggle('editing', editing)
);
// If editing is true on mount, 'editing' class won't be added until it changes!

// ✅ With immediate - initial state applied correctly
this.watch(
  () => this.state.editing,
  (editing) => this.classList.toggle('editing', editing),
  { immediate: true }
);
// Class added immediately based on initial state

// ⚠️ Note: On first call with immediate, oldValue equals newValue
this.watch(
  () => this.state.count,
  (newValue, oldValue) => {
    console.log(newValue, oldValue); // 0, 0 on first call
  },
  { immediate: true }
);

// ✅ Another common use case - initial focus
this.watch(
  () => this.state.autofocus,
  (shouldFocus) => {
    if (shouldFocus) this.querySelector('input')?.focus();
  },
  { immediate: true } // Apply focus on mount if autofocus is true
);
```

**Reference Equality Details:**

The `watch()` helper uses strict equality (`===`) for change detection:

```javascript
const state = reactive({
  items: [1, 2, 3],
  user: { name: 'Alice' }
});

// ❌ Won't trigger - same array reference
this.watch(() => state.items, callback);
state.items.push(4); // Callback NOT called

// ✅ Triggers - new array reference
state.items = [...state.items, 4]; // Callback called

// ❌ Won't trigger - same object reference
this.watch(() => state.user, callback);
state.user.name = 'Bob'; // Callback NOT called

// ✅ Triggers - new object reference
state.user = { ...state.user, name: 'Bob' }; // Callback called

// ✅ Alternative - watch specific property
this.watch(() => state.user.name, callback);
state.user.name = 'Bob'; // Callback called
```

**Design decision:** Reference equality is fast and predictable. For deep watching, watch specific properties.

#### `effect(fn: () => void): () => void`

Creates effect with automatic cleanup.

```javascript
async connectedCallback() {
  await super.connectedCallback();

  this.effect(() => {
    console.log('Count:', this.state.count);
  });
}
```

### Other Methods

#### `update(): Promise<void>`

Manually trigger re-render.

```javascript
async handleChange() {
  // Modify state
  await this.update();
}
```

#### `populate(): Promise<void>`

Populate component from model (internal use).

---

## Expression Parser

The Expression Parser evaluates template expressions like `{this.state.count}` in a safe, restricted manner.

### Supported Syntax

**✅ Supported:**
- Dot notation: `{this.state.count}`
- Optional chaining: `{this.user?.name}`
- Numeric array access: `{this.items.0}`
- Nested access: `{this.state.model.v-s:title.0}`
- Dashes in property names: `{this.state.model.v-s:hasValue}`

**❌ Not Supported:**
- Operators: `{this.a + this.b}` ❌
- Function calls: `{this.format(date)}` ❌
- Ternary operators: `{this.show ? 'yes' : 'no'}` ❌
- Bracket notation: `{this.items['key']}`, `{this.state.model['v-s:title']}` ❌
- Method calls: `{this.items.map(x => x)}` ❌

**Instead use:**
- For numeric indices: `{this.items.0}` ✅
- For properties with dashes: `{this.state.model.v-s:title.0}` ✅

### Examples

```javascript
// ✅ Simple property access
<div>{this.state.count}</div>

// ✅ Nested property
<div>{this.user.profile.name}</div>

// ✅ Optional chaining
<div>{this.user?.email}</div>

// ✅ Array element access
<li>{this.todos.0.title}</li>

// ✅ RDF property names with dashes/colons
<span>{this.state.model.v-s:title.0}</span>

// ❌ Complex expression - use computed property instead
get incrementedCount() {
  return this.state.count + 1;
}
<div>{this.incrementedCount}</div>

// ❌ Ternary - use computed property
get statusText() {
  return this.isActive ? 'Active' : 'Inactive';
}
<span>{this.statusText}</span>
```

### Error Handling

When an expression fails to evaluate:
- Returns empty string `''`
- Logs warning to console
- Does not throw (prevents render breaking)

```javascript
<div>{this.nonExistent.property}</div>
// Console: "Invalid expression 'this.nonExistent.property': ..."
// Renders: <div></div>
```

### Evaluation Context

Expressions are evaluated in the component's context:

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    this.state.count = 0;
  }

  render() {
    // 'this' refers to the component instance
    return html`<div>{this.state.count}</div>`;
  }
}
```

In Loop/If components, access data through the named variable:

```javascript
<${Loop} items="{this.todos}" key="id" as="todo">
  <li>{todo.text}</li>
  <!-- 'todo' is the current todo item, 'index' is always available -->
</${Loop}>
```

### Performance

- Expression parsing happens once during template compilation
- Reactive tracking is automatic (via Effect system)
- No runtime eval() or Function() - secure and fast

### Why Limited Syntax?

**Security:**
- No eval() or Function() constructor
- Cannot execute arbitrary code
- Safe for user-provided templates

**Simplicity:**
- Easy to understand what expressions do
- Predictable behavior
- Encourages computed properties for complex logic

**Recommendation:** For any logic beyond simple property access, use computed properties (getters).

---

## Reactivity

Fine-grained reactivity system with automatic dependency tracking.

### `reactive<T>(target: T, options?): T`

Creates reactive proxy.

```javascript
import { reactive } from 'veda-client';

const state = reactive({
  count: 0,
  user: { name: 'Alice' }
});

state.count++; // Triggers effects
```

**Options:**
```typescript
interface ReactiveOptions {
  onSet?: (key: string | symbol, value: any, oldValue: any) => void;
  onDelete?: (key: string | symbol) => void;
}
```

**Features:**
- Deep reactivity (nested objects automatically wrapped)
- Array mutation tracking:
  - **Mutation methods** (`push`, `pop`, `shift`, `unshift`, `splice`) - always trigger reactivity
  - **Sorting methods** (`sort`, `reverse`) - trigger only if array actually changes (optimized)
- Circular reference handling
- Prototype pollution prevention

**Security - Prototype Pollution Protection:**

The reactive system blocks setting dangerous property names to prevent prototype pollution attacks:

```javascript
const state = reactive({});

// ❌ Blocked - dangerous property names
state.__proto__ = maliciousObject;     // Silently ignored + warning
state.constructor = maliciousFunction; // Silently ignored + warning
state.prototype = maliciousProto;      // Silently ignored + warning

// Console warning: "Reactive.set: Blocked dangerous property name: __proto__"
```

**Dangerous properties list:**
- `__proto__`
- `constructor`
- `prototype`

**Why this matters:**
Prevents prototype pollution attacks where malicious code could modify Object.prototype and affect all objects in your application.

**Limitations:**
- New properties need explicit wrapping
- Date, RegExp, Promise not wrapped

**Note on array reactivity:**
Array index assignment IS reactive when effects track specific indices. This is fine-grained reactivity - effects only re-run when they access properties that change. See [REACTIVITY.md](./REACTIVITY.md#fine-grained-array-reactivity) for details.

### `computed<T>(getter: () => T)`

Creates computed value with automatic dependency tracking and caching.

```javascript
import { computed } from 'veda-client';

const state = reactive({ count: 0 });
const doubled = computed(() => state.count * 2);

console.log(doubled.value); // 0
state.count = 5;
console.log(doubled.value); // 10
```

**Features:**
- Lazy evaluation: computed on first access
- Automatic caching: recalculates only when dependencies change
- Priority execution: computed effects run before regular effects

**Implementation details:**

`computed()` uses a custom effect with a `scheduler` to implement lazy caching. The actual implementation from `src/Reactive.js`:

```javascript
export function computed(getter) {
  let value;
  let dirty = true;

  const computed = {
    get value() {
      if (dirty) {
        value = getter();
        dirty = false;
      }
      track(this, 'value');
      return value;
    }
  };

  effect(() => {
    void computed.value;
  }, {
    lazy: false,
    computed: true,  // Runs FIRST before regular effects
    scheduler: () => {
      if (!dirty) {
        dirty = true;
        trigger(computed, 'value');
      }
    }
  });

  return computed;
}
```

**Key implementation points:**
- **Dirty flag caching:** Getter only re-runs when `dirty === true`
- **Custom scheduler:** When dependencies change, scheduler sets `dirty = true` and triggers computed dependents (doesn't re-run getter immediately)
- **Lazy recalculation:** Actual computation happens on `.value` access when dirty
- **Priority execution:** `computed: true` ensures it runs before regular effects

**Example - caching behavior:**

```javascript
const state = reactive({ count: 0 });
let runCount = 0;

const doubled = computed(() => {
  runCount++;
  return state.count * 2;
});

console.log(doubled.value); // runCount = 1 (computed)
console.log(doubled.value); // runCount = 1 (cached!)
console.log(doubled.value); // runCount = 1 (cached!)

state.count = 5;
// Scheduler marks dirty, but doesn't run getter yet

console.log(doubled.value); // runCount = 2 (recomputed)
console.log(doubled.value); // runCount = 2 (cached!)
```

**Note:** Access via `.value` property.

### `effect(fn: () => void, options?): () => void`

Creates auto-tracking effect.

```javascript
import { effect } from 'veda-client';

const cleanup = effect(() => {
  console.log('Count:', state.count);
});

state.count++; // Logs: "Count: 1"

cleanup(); // Stop effect
```

**Options:**
```typescript
interface EffectOptions {
  lazy?: boolean;           // Don't run immediately (default: false)
  scheduler?: (fn) => void; // Custom scheduler function
  computed?: boolean;       // Mark as computed effect (runs first)
}
```

**Features:**
- Automatic dependency tracking
- Batched async execution (via microtask)
- Infinite loop detection (max 100 triggers)
- Automatic cleanup

**Scheduler Example:**

```javascript
import { effect } from 'veda-client';

// Debounced effect
let timeout;
effect(() => {
  console.log('Count:', state.count);
}, {
  scheduler: (fn) => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, 300); // Debounce 300ms
  }
});
```

**Computed Priority:**

Effects with `computed: true` run before regular effects:

```javascript
// This runs FIRST (computed)
effect(() => {
  derivedValue = state.count * 2;
}, { computed: true });

// This runs SECOND (regular)
effect(() => {
  console.log('Derived:', derivedValue);
});
```

This ensures computed values are always up-to-date before dependent effects run.

### `flushEffects(): Promise<void>`

Manually flush queued effects.

```javascript
import { flushEffects } from 'veda-client';

state.count = 5;
await flushEffects(); // Wait for effects to run
```

**Use cases:**
- Testing
- Manual timing control

### `pauseTracking()`

Temporarily pause dependency tracking.

```javascript
import { pauseTracking, resumeTracking } from 'veda-client';

effect(() => {
  const count = state.count; // Tracked

  pauseTracking();
  const other = state.other; // NOT tracked
  resumeTracking();

  console.log(count, other);
});

state.count++; // Effect runs
state.other++; // Effect does NOT run
```

**⚠️ Warning:** While these functions use a depth counter to handle nesting mechanically, **manual nesting produces warnings and is error-prone**. **Use `untrack(fn)` instead** for safe nesting.

**How it works:**
- Uses `trackingDepth` counter (not a simple boolean flag)
- `pauseTracking()` increments depth and **logs warning if already paused** (depth > 0)
- `resumeTracking()` decrements depth
- Tracking resumes only when depth reaches 0

**Why nested calls are discouraged:**

```javascript
// ⚠️ FRAGILE - manual nesting works but is error-prone
pauseTracking();
  pauseTracking(); // depth=2, warning logged, tracking still OFF
  // If you forget matching resumeTracking(), tracking stays OFF forever!
  resumeTracking(); // depth=1, tracking still OFF
resumeTracking(); // depth=0, tracking ON

// ❌ DANGEROUS - exception breaks tracking
pauseTracking();
throw new Error('Boom!'); // Exception thrown
resumeTracking(); // ← Never executes! Tracking stays OFF forever!

// ✅ SAFE - use untrack() instead
untrack(() => {
  // Nested untrack automatically works:
  untrack(() => {
    // Properly nested, exception-safe
  });
  // Even if exception thrown, tracking resumes (via finally)
});
```

**Why `untrack()` is better:**
- Automatic cleanup (via try/finally)
- Exception-safe (resumeTracking() always called)
- Proper nesting out of the box
- Returns function result

**Use cases:**
- Reading state without creating dependencies
- Performance optimization (skip tracking for known static values)
- Debugging (isolate which dependencies trigger effects)

**Recommendation:** Always prefer `untrack(fn)` over manual pause/resume.

### `resumeTracking()`

Resume dependency tracking after `pauseTracking()`.

```javascript
pauseTracking();
// ... code without tracking ...
resumeTracking();
```

**Note:** Must be paired with `pauseTracking()`. Supports nested calls via depth counter, but manual nesting is error-prone. Use `untrack(fn)` for safe nesting.

### `untrack(fn)`

Execute function without tracking dependencies.

```javascript
import { untrack } from 'veda-client';

effect(() => {
  const tracked = state.count; // Tracked

  const untracked = untrack(() => {
    return state.other + state.more; // NOT tracked
  });

  console.log(tracked, untracked);
});

state.count++; // Effect runs
state.other++; // Effect does NOT run
```

**Difference from pauseTracking:**
- `untrack()` - scoped to callback function (recommended)
- `pauseTracking()` - manual control (requires resumeTracking())

**Use cases:**
- Same as `pauseTracking()` but safer (automatic cleanup)
- Preferred over manual pause/resume

### `trigger(target, key)`

Manually trigger effects for a property.

```javascript
import { trigger } from 'veda-client';

// Rarely needed - mostly for internal use
trigger(state, 'count'); // Force notify all effects tracking state.count
```

**Note:** Usually not needed as reactive system handles this automatically.

---

## Reactivity Edge Cases

This section documents special behaviors and corner cases you might encounter.

### Circular References

The reactive system handles circular references automatically using WeakMap caching:

```javascript
const obj = reactive({ name: 'A' });
obj.self = obj; // Circular reference

// ✅ Works correctly - no infinite loop
effect(() => {
  console.log(obj.name, obj.self.name); // Both access the same proxy
});
```

**How it works:**
- Each object is wrapped only once (cached in WeakMap)
- Subsequent access returns the same proxy
- No memory leaks (WeakMap allows garbage collection)

### Fine-Grained Array Reactivity

Array index assignment **IS reactive** with fine-grained tracking:

```javascript
const state = reactive({ items: [1, 2, 3] });

// ✅ Effect tracks items[0] - will react to changes
effect(() => {
  console.log('First:', state.items[0]);
});

state.items[0] = 99; // ✅ Triggers effect!

// ✅ Effect tracks specific indices independently
effect(() => {
  console.log('Second:', state.items[1]);
});

state.items[0] = 88; // ✅ Triggers first effect only
state.items[1] = 77; // ✅ Triggers second effect only
```

**Key insight:** Effects only re-run when properties they **actually read** change.

```javascript
// Effect only tracks length
effect(() => {
  console.log('Length:', state.items.length);
});

state.items[0] = 99; // ❌ Won't trigger (length unchanged)
state.items.push(4);  // ✅ Triggers (length changed)
```

**Array methods trigger all tracking:**
```javascript
// These methods modify multiple properties and trigger all effects
state.items.push(4);      // Modifies length and new index
state.items.splice(0, 1); // Modifies indices and length
state.items.sort();       // Modifies all indices
```

**Comparison with other frameworks:**
- Vue 3: Also uses Proxy with index tracking
- Solid.js: Uses fine-grained signals (similar approach)
- Veda: Proxy-based fine-grained reactivity

### Dynamic key in Loop

**⚠️ Not supported:** Changing `key` attribute dynamically will not trigger re-reconciliation:

```javascript
// ❌ BROKEN - key should be static
<${Loop} items="{this.items}" key="{this.currentKey}">

// ✅ CORRECT - key is static
<${Loop} items="{this.items}" key="id">
<${Loop} items="{this.items}" key="id" as="item">
```

**Reason:** Loop component reads `key` once during initialization. Dynamic keys would require complete re-initialization.

### Expression Evaluation with undefined/null

Expressions that evaluate to `undefined` or `null` render as empty strings:

```javascript
// Model has no 'v-s:title' property
<div>{this.model.v-s:title.0}</div>
// Renders as: <div></div>

// Optional chaining prevents errors
<div>{this.model?.title?.name}</div>
// If any part is undefined, renders empty string
```

**Attributes:**

```javascript
// Boolean attributes with undefined/null
<input checked="{this.completed}" />
// If completed is undefined/null -> checked="false" -> unchecked

// Regular attributes with undefined/null
<div data-id="{this.id}">
// If id is undefined -> data-id="" (empty string)
```

### Computed Values and Circular Dependencies

Computed values can accidentally create circular dependencies:

```javascript
// ❌ INFINITE LOOP - computed depends on itself
const state = reactive({ count: 0 });

const doubled = computed(() => {
  return doubled.value * 2; // Reads its own value!
});

// System detects this and throws after 100 iterations
```

**Solution:** Ensure computed values only depend on other state:

```javascript
// ✅ CORRECT - depends on external state
const doubled = computed(() => state.count * 2);
```

### Nested pauseTracking Calls

The tracking system uses a depth counter (not a simple boolean flag):

```javascript
// Works correctly but logs warning
pauseTracking();      // depth=1, tracking OFF
  pauseTracking();    // depth=2, warning logged, tracking still OFF
  resumeTracking();   // depth=1, tracking still OFF
resumeTracking();     // depth=0, tracking ON

// Tracking resumes ONLY when depth reaches 0
```

**Why untrack is better:**
```javascript
// ✅ CORRECT - use untrack for nesting
untrack(() => {
  // Can safely call untrack again inside
  untrack(() => {
    // Properly nested
  });
});
```

**The real danger:**
```javascript
// ❌ BROKEN by exception
pauseTracking();
throw new Error('Boom!'); // Exception thrown
resumeTracking(); // ← Never executes! Tracking stays OFF forever!

// ✅ SAFE - untrack uses try/finally
untrack(() => {
  throw new Error('Boom!');
}); // resumeTracking() still called via finally
```

**Why the warning exists:**
- Not because nested calls break (they work via depth counter)
- But because manual pause/resume is error-prone without try/finally
- `untrack()` automatically handles cleanup and exceptions

### Model Property Reactivity

Model properties in `this.state.model` are automatically reactive:

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    this.state.model = new Model('d:123');
  }

  render() {
    // This expression will re-render when model changes
    return html`<div>{this.state.model['v-s:title'].0}</div>`;
  }
}
```

Components can access model properties through `this.state.model`:

```javascript
class MyComponent extends Component(HTMLElement) {
  render() {
    // ✅ Updates automatically when model changes
    return html`<div>{this.state.model['v-s:title'].0}</div>`;
  }
}
```

### Effect Cleanup Timing

Effects are cleaned up automatically but timing matters:

```javascript
class MyComponent extends Component(HTMLElement) {
  async connectedCallback() {
    await super.connectedCallback();

    // ✅ Auto-cleanup on disconnect
    this.effect(() => {
      console.log('Count:', this.state.count);
    });
  }

  disconnectedCallback() {
    // Effects already cleaned up by Component base class
    super.disconnectedCallback();
  }
}
```

**Cleanup Order (disconnectedCallback):**

```
1. disconnectedCallback() called
2. Component.#cleanupEffects() runs    ← Effects cleaned up FIRST
3. this.removed() lifecycle hook runs
4. Component fully disconnected
```

**Cleanup Order (re-render/update):**

```
1. update() called
2. Old #renderEffects cleaned up       ← Old effects removed
3. render() generates new template
4. New #renderEffects created          ← New effects for new template
5. post() lifecycle hook runs
```

**Key points:**
- Effect cleanup happens **BEFORE** `removed()` lifecycle
- Re-render clears old render effects **BEFORE** creating new ones
- User effects (via `this.effect()`) persist across re-renders
- User effects are only cleaned up on disconnect

**Manual effects:**

```javascript
// Create effect outside component
const cleanup = effect(() => {
  console.log(state.count);
});

// ❌ MEMORY LEAK - never cleaned up
// Effect runs forever even if object is destroyed

// ✅ CORRECT - manual cleanup
cleanup();
```

### Reactive Proxy and instanceof

Proxies maintain instanceof relationships:

```javascript
const model = new Model('d:Person1');
const proxy = reactive(model);

// ✅ Works correctly
console.log(proxy instanceof Model); // true
console.log(proxy.__isReactive); // true
```

**But:**

```javascript
const arr = reactive([1, 2, 3]);
console.log(Array.isArray(arr)); // true ✅
console.log(arr instanceof Array); // true ✅

const date = reactive(new Date());
console.log(date instanceof Date); // false ❌
// Date objects are NOT wrapped (returned as-is)
```

**Objects not wrapped:**
- `Date`
- `RegExp`
- `Promise`
- `null`/`undefined`
- Primitives (numbers, strings, booleans)

---

## Built-in Components

### Loop

Renders reactive lists with key-based reconciliation.

```javascript
import { Loop } from 'veda-client';

// Component syntax
<${Loop} items="{this.state.todos}" as="todo" key="id">
  <li>{todo.text}</li>
  <li>{index}. {todo.text}</li>  <!-- index always available -->
</${Loop}>

// Semantic HTML syntax
<ul items="{this.state.todos}" as="todo" key="id">
  <li>{todo.text}</li>
</ul>
```

**Attributes:**
- `items` - Expression returning array (required)
- `as` - Variable name for current item (default: `'item'`)
- `key` - Property name for reconciliation (default: `'id'`)

**Special variables:**
- `{as_name}` - Current item (e.g., `{todo}`)
- `{index}` - Current index (0-based, always available)

**Features:**
- **Array reactivity:** Array mutation methods (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`) automatically trigger reconciliation
- **Reference changes:** Replacing array reference also triggers reconciliation
- **Index access:** `{index}` always available for numbering/styling
- **Key-based reconciliation:** Reuses DOM elements for performance
- **Semantic HTML:** Use `items` attribute directly on any element

**Semantic HTML:**

Use `items` attribute directly on any element for better HTML structure:

```javascript
// Lists
<ul items="{this.state.todos}" as="todo" key="id">
  <li>{index + 1}. {todo.text}</li>
</ul>

// Tables
<table>
  <tbody items="{this.state.users}" as="user" key="id">
    <tr>
      <td>{user.name}</td>
      <td>{user.email}</td>
    </tr>
  </tbody>
</table>
```

**Why semantic HTML?**
- Better HTML structure
- Improved accessibility
- CSS selectors work naturally (`ul > li`)

**Passing data to child components:**

```javascript
<${Loop} items="{this.state.todos}" as="todo" key="id">
  <todo-item :todo="{todo}" :index="{index}"></todo-item>
</${Loop}>

// Child component
class TodoItem extends Component(HTMLElement) {
  render() {
    return html`
      <li>{this.state.index}. {this.state.todo.text}</li>
    `;
  }
}
```

**Limitations:**
- **Single root element required:** Template must have exactly one root element per iteration
- **Duplicate keys warning:** Items must have unique key values
- **Static attributes:** `as` and `key` must be static strings
- Source array must be reactive
- Naive reconciliation (O(n²) for reordering)
- No virtualization

**Common Issues and Solutions:**

1. **Loop not updating:**

```javascript
// ✅ CORRECT - Array mutation methods trigger all effects
this.state.items.push(newItem);        // Works!
this.state.items.splice(0, 1, newItem); // Works!
this.state.items.sort();                // Works!

// ✅ CORRECT - Reference change also works
this.state.items = [...this.state.items, newItem];

// ✅ CORRECT - Index assignment works if Loop tracks it
this.state.items[0] = updatedItem; // Works! Loop iterates all items

// ⚠️ Note: Loop tracks all items it renders
// If you need finer control, use effects with specific indices
```

**Note:** If Loop still doesn't update, check that:
- The array is reactive: `this.state.items = []` (state is automatically reactive)
- You're not watching the array with `watch()` (which uses reference equality)

2. **Multiple root elements warning:**

```javascript
// ❌ WRONG - Multiple roots
<${Loop} items="{this.todos}" key="id" as="todo">
  <h3>{todo.title}</h3>
  <p>{todo.description}</p>
</${Loop}>
// Console: "Loop component: Multiple root elements detected.
//           Please wrap them in a single root element (e.g. <div>, <li>, etc.).
//           Only the first element will be used, others will be ignored."

// ✅ CORRECT - Single root wraps everything
<${Loop} items="{this.todos}" key="id" as="todo">
  <div class="todo-item">
    <h3>{todo.title}</h3>
    <p>{todo.description}</p>
  </div>
</${Loop}>
```

3. **Duplicate keys cause wrong reconciliation:**

```javascript
// ❌ WRONG - Duplicate keys
const items = [
  { id: 1, text: 'First' },
  { id: 1, text: 'Second' },  // Duplicate id!
  { id: 2, text: 'Third' }
];
// Console: "Loop component: Duplicate key "1" found.
//           Current item: {id: 1, text: 'Second'}
//           Previous item: {id: 1, text: 'First'}"
// Result: Only 'Second' will be rendered (last item wins)
//         'First' is overwritten in internal Map

// ✅ CORRECT - Unique keys
const items = [
  { id: 1, text: 'First' },
  { id: 2, text: 'Second' },
  { id: 3, text: 'Third' }
];
// Result: All 3 items rendered correctly
```

**Why this happens:** Loop uses `Map.set(key, itemData)`. Duplicate keys overwrite previous entries, so only the last item with that key is tracked.

4. **Performance degradation with large lists:**

```javascript
// ⚠️ SLOW - 1000+ items with frequent reordering
<${Loop} items="{this.largeList}" key="id" as="item">
  <div>{this.model.name}</div>
</${Loop}>

// ✅ BETTER - Pagination
get currentPage() {
  const { page, pageSize } = this.state;
  return this.allItems.slice(page * pageSize, (page + 1) * pageSize);
}

<${Loop} items="{this.currentPage}" key="id" as="item">
  <div>{this.model.name}</div>
</${Loop}>
```

5. **Missing key causes full re-render:**

```javascript
// ❌ WRONG - No key, every update re-creates all elements
<${Loop} items="{this.items}" as="item">
  <div>{item.name}</div>
</${Loop}>

// ✅ CORRECT - With key, reuses existing elements
<${Loop} items="{this.items}" key="id" as="item">
  <div>{item.name}</div>
</${Loop}>
```

**Performance Characteristics:**

| Operation | Time Complexity | Measured (500 items) | Notes |
|-----------|----------------|---------------------|-------|
| Add new items | O(n) | ~9ms | Create n new DOM elements |
| Remove items | O(m) | ~8ms | Remove m DOM elements |
| Update items | O(n) | ~7ms | Update n changed elements |
| Reorder items | O(n²) | ~17ms | Naive sequential insertion |
| Lookup by key | O(1) | <0.01ms | Uses Map for key lookup |

**Detailed benchmarks:**
- 100 items reorder: 2.31ms (excellent)
- 500 items reorder: 17.24ms (good)
- 1000 items reorder: 53.62ms (noticeable)

See `test/benchmarks/LoopPerformance.test.js` for complete measurements.

**Recommendations:**
- Always provide `key` for efficient reconciliation
- Keep lists under 500 items for optimal performance
- Use pagination for large datasets (1000+ items)
- Avoid frequent reordering of large lists
- Consider virtual scrolling for very large lists (see LIMITATIONS.md)

**Important - Template Structure:**

```javascript
// ❌ WRONG - Multiple root elements
<${Loop} items="{this.todos}" key="id" as="item">
  <h3>{this.model.title}</h3>
  <p>{this.model.description}</p>
</${Loop}>
// Console warning! Only <h3> will be rendered

// ✅ CORRECT - Single root element
<${Loop} items="{this.todos}" key="id" as="item">
  <div class="todo-item">
    <h3>{this.model.title}</h3>
    <p>{this.model.description}</p>
  </div>
</${Loop}>
```

**Example:**

```javascript
class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state.todos = [
      { id: 1, text: 'Task 1', done: false }
    ];
  }

  addTodo = () => {
    this.state.todos = [
      ...this.state.todos,
      { id: Date.now(), text: 'New task', done: false }
    ];
  };

  render() {
    return html`
      <ul>
        <${Loop} items="{this.state.todos}" key="id" as="todo">
          <li>
            <input type="checkbox" checked="{todo.done}" />
            <span>{todo.text}</span>
          </li>
        </${Loop}>
      </ul>
      <button onclick="{addTodo}">Add</button>
    `;
  }
}
```

### If

Conditional rendering.

```javascript
import { If } from 'veda-client';

<${If} condition="{this.state.isVisible}">
  <div>Content</div>
</${If}>
```

**Attributes:**
- `condition` - Expression evaluated as boolean (required)

**Features:**
- Creates/removes content based on condition
- Leaves comment node when hidden
- Child elements cloned when shown
- Same evalContext as Loop (access parent state/methods)

**Example:**

```javascript
class ConditionalView extends Component(HTMLElement) {
  constructor() {
    super();
    this.state.isLoggedIn = false;
    this.state.hasPermission = false;
  }

  render() {
    return html`
      <${If} condition="{this.state.isLoggedIn}">
        <div>Welcome back!</div>

        <${If} condition="{this.state.hasPermission}">
          <admin-panel></admin-panel>
        </${If}>
      </${If}>

      <${If} condition="{!this.state.isLoggedIn}">
        <login-form></login-form>
      </${If}>
    `;
  }
}
```

### Property

Renders RDF property values with language support and reactive updates.

**Note:** PropertyComponent is **not exported** from the main package. It's designed for **declarative usage** only via the `property` attribute on standard HTML elements.

#### Declarative Usage (Recommended)

```javascript
// Declarative syntax (recommended - ONLY way to use)
<span property="v-s:title"></span>

// ❌ NOT AVAILABLE - PropertyComponent is not exported
import PropertyComponent from './src/components/PropertyComponent.js'; // Won't work from index.js
```

**Implementation Detail:** The framework automatically upgrades elements with `property` attribute to PropertyComponent instances. See [Advanced Components](#advanced-components) for details.

**Attributes:**
- `property` - RDF property name (required)
- `lang` - Language filter (optional, auto-detected)
- `shadow` - Use Shadow DOM (optional)
- `about` - Model URI (optional, inherits from parent)

**Features:**
- Automatically renders property values from model
- Language filtering (e.g., `Title^^EN` vs `Title^^RU`)
- Reactive updates when model property changes
- Supports custom templates with `<slot>` or text content

**Example - Simple:**

```javascript
class PersonCard extends Component(HTMLElement) {
  render() {
    return html`
      <h1 property="v-s:title"></h1>
      <p property="v-s:description"></p>
    `;
  }
}
```

**Example - With Custom Content:**

```javascript
render() {
  return html`
    <div property="v-s:email">
      <a href="mailto:"><slot></slot></a>
    </div>
  `;
}
// Renders: <a href="mailto:">user@example.com</a>
```

**Language Support:**

```javascript
// Model has: {'v-s:title': ['Hello^^EN', 'Привет^^RU']}

// User's browser lang = 'en'
<span property="v-s:title"></span>
// Renders: "Hello"

// User's browser lang = 'ru'
<span property="v-s:title"></span>
// Renders: "Привет"
```

**Shadow DOM Isolation:**

```javascript
// Use shadow attribute for style isolation
<div property="v-s:userContent" shadow>
  <style>
    /* Scoped styles - won't leak out */
    p { color: blue; font-size: 14px; }
  </style>
  <p><slot></slot></p>
</div>
```

**Benefits of Shadow DOM:**
- Styles contained within component
- Prevents CSS conflicts
- Encapsulation for untrusted content

**Custom Template Examples:**

```javascript
// Email with mailto link
<div property="v-s:email">
  <a href="mailto:"><slot></slot></a>
</div>
// Renders: <a href="mailto:">user@example.com</a>

// Phone with tel link
<span property="v-s:phone">
  <a href="tel:"><slot></slot></a>
</span>
// Renders: <a href="tel:">+1234567890</a>

// URL with link
<div property="v-s:website">
  <a href="{this.model.v-s:website.0}" target="_blank">
    <slot></slot>
  </a>
</div>

// Formatted date
<time property="v-s:created">
  <span class="date"><slot></slot></span>
</time>
```

**How it works:**
- Inherits `model` from parent component automatically
- Creates reactive effect to re-render on property changes
- Filters by document language (`document.documentElement.lang`)

### Relation

Renders related RDF resources (URI values) with automatic model loading and custom templates.

**Note:** RelationComponent is **not exported** from the main package. It's designed for **declarative usage** only via the `rel` attribute on standard HTML elements.

#### Declarative Usage (Recommended)

```javascript
// Declarative syntax (recommended - ONLY way to use)
<ul rel="v-s:hasTodo">
  <li>{this.model.v-s:title.0}</li>
</ul>

// ❌ NOT AVAILABLE - RelationComponent is not exported
import RelationComponent from './src/components/RelationComponent.js'; // Won't work from index.js
```

**Implementation Detail:** The framework automatically upgrades elements with `rel` attribute to RelationComponent instances. See [Advanced Components](#advanced-components) for details.

**Attributes:**
- `rel` - RDF relation property name (required)
- `shadow` - Use Shadow DOM (optional)
- `about` - Model URI (optional, inherits from parent)

**Features:**
- Automatically loads related models
- Each child receives `model` prop with related resource
- Reactive updates when relation changes
- Supports custom templates

**Example - Simple:**

```javascript
class TodoList extends Component(HTMLElement) {
  render() {
    return html`
      <ul rel="v-s:hasTodo">
        <li>{this.model.v-s:title.0}</li>
      </ul>
    `;
  }
}
```

**Example - With Custom Components:**

```javascript
render() {
  return html`
    <div rel="v-s:hasAuthor">
      <person-card></person-card>
    </div>
  `;
}
// Each person-card receives related Person model
```

**Shadow DOM with Relation:**

```javascript
// Isolate styles for related items
<ul rel="v-s:hasAttachment" shadow>
  <style>
    li {
      border: 1px solid #ccc;
      padding: 8px;
      margin: 4px 0;
    }
    a { color: blue; text-decoration: none; }
  </style>
  <li>
    <a href="{this.model.v-s:url.0}">
      {this.model.v-s:fileName.0}
    </a>
  </li>
</ul>

// Complex example with styled cards
<div rel="v-s:hasTeamMember" shadow>
  <style>
    .member-card {
      display: flex;
      align-items: center;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin: 8px 0;
    }
    .avatar {
      width: 48px;
      height: 48px;
        border-radius: 50%;
        margin-right: 12px;
      }
    </style>
    <div class="member-card">
      <img class="avatar" src="{this.model.v-s:avatar.0}" alt="Avatar" />
      <div>
        <h4>{this.model.v-s:name.0}</h4>
        <p>{this.model.v-s:role.0}</p>
      </div>
    </div>
</div>
```

**Benefits of Shadow DOM with Relation:**
- Each related item has isolated styles
- No CSS conflicts between items
- Clean encapsulation of item presentation
- Reusable styling patterns

**Difference from Loop:**

| Feature | Relation | Loop |
|---------|----------|------|
| Data source | RDF property (URI[]) | Any array |
| Model loading | Automatic | Manual |
| Use case | Semantic relations | Generic lists |
| Reconciliation | No keys | Key-based |

**Example - Relation vs Loop:**

```javascript
// ✅ Use Relation for RDF relations
<div rel="v-s:hasAttachment">
  <file-preview></file-preview>
</div>

// ✅ Use Loop for generic arrays
<${Loop} items="{this.todos}" key="id" as="item">
  <todo-item></todo-item>
</${Loop}>
```

---

## Advanced Components

The framework supports powerful declarative syntax using `property` and `rel` attributes on ANY HTML element. This works through an automatic component upgrade mechanism.

### The "Magic" Mechanism

When you write:
```html
<div property="v-s:title"></div>
```

The framework automatically upgrades this `<div>` into a reactive `PropertyComponent`.

1. **Detection:** The framework scans for elements with `property` or `rel` attributes during component rendering.
2. **Registration:** It dynamically registers a new Custom Element (e.g., `div-property-component`).
3. **Upgrade:** The element is upgraded to use the special component class (extends `PropertyComponent` or `RelationComponent`).
4. **Reactivity:** The component automatically subscribes to the model's property and re-renders on changes.

### Why Not Exported?

PropertyComponent, RelationComponent, and ValueComponent are **internal implementation details**. They:

- Are designed to work through the declarative attribute mechanism
- Require special setup that happens automatically during component rendering
- Should not be instantiated manually

If you need programmatic control, consider:
- Using Loop component with manual model handling
- Creating custom components that inherit model reactivity

### Internal Components

| Component | Purpose | Usage |
|-----------|---------|-------|
| `PropertyComponent` | Render RDF property values | `<span property="v-s:title"></span>` |
| `RelationComponent` | Render related models | `<ul rel="v-s:hasTodo"></ul>` |
| `ValueComponent` | Base for Property/Relation | `<div property="...">` or `<div rel="...">` |

#### ValueComponent - Base Class

**ValueComponent** is the foundation for both PropertyComponent and RelationComponent. It provides common functionality for rendering model properties.

**Location:** `./src/components/ValueComponent.js`

**Export status:** NOT exported from `index.js` - internal use only

**Inheritance hierarchy:**
```
Component (base)
  └── ValueComponent
       ├── PropertyComponent
       └── RelationComponent
```

**Core responsibilities:**

1. **Automatic model integration** - Inherits `model` from parent component
2. **Reactive rendering** - Creates effect that auto-updates when model properties change
3. **Custom rendering** - Supports custom HTML structure for rendering values
4. **Shadow DOM support** - Optional style isolation via `shadow` attribute

**Implementation details:**

```javascript
export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponentClass extends Component(Class) {
    #propEffect = null;
    #valueNodes = new Map();

    added() {
      this.prop = this.getAttribute('property') ?? this.getAttribute('rel');

      // Create reactive effect
      if (!this.#propEffect) {
        this.#propEffect = effect(() => {
          this.render();
        });
      }
    }

    removed() {
      // Cleanup
      if (this.#propEffect) {
        this.#propEffect();
        this.#propEffect = null;
      }
      this.#valueNodes.clear();
    }

    render() {
      const container = this.hasAttribute('shadow')
        ? this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot)
        : this;

      const values = this.model.hasValue(this.prop)
        ? (Array.isArray(this.model[this.prop]) ? this.model[this.prop] : [this.model[this.prop]])
        : [];

      container.replaceChildren();
      this.#valueNodes.clear();

      values.forEach((value, index) => {
        this.renderValue(value, container, index);
      });
    }

    renderValue(value, container, index) {
      const node = document.createTextNode(value.toString());
      container.appendChild(node);
      this.#valueNodes.set(index, {value, node});
    }
  };
}
```

**When to use ValueComponent:**

❌ **Don't use directly** - it's an internal base class

✅ **Use PropertyComponent or RelationComponent** via declarative syntax:
```javascript
// Property for simple values
<span property="v-s:title"></span>

// Relation for linked resources
<ul rel="v-s:hasTodo">
  <li>{this.model.text}</li>
</ul>
```

**Extending ValueComponent:**

If you need custom behavior, you can extend PropertyComponent or RelationComponent directly (not from index.js):

```javascript
import PropertyComponent from './src/components/PropertyComponent.js';

// Custom property component with formatting
const FormattedProperty = PropertyComponent(HTMLElement);

class MyFormattedProperty extends FormattedProperty {
  renderValue(value, container, index) {
    // Custom formatting logic
    const formatted = this.formatValue(value);
    const node = document.createTextNode(formatted);
    container.appendChild(node);
  }

  formatValue(value) {
    // Example: uppercase
    return value.toString().toUpperCase();
  }
}

customElements.define('my-formatted-property', MyFormattedProperty);
```

**Key features inherited from ValueComponent:**

1. **Automatic model detection** - Looks for `model` property in parent chain
2. **Reactive updates** - Effect tracks `this.model[this.prop]` automatically
3. **Cleanup on disconnect** - Effect and value nodes cleaned up properly
4. **Shadow DOM support** - Via `shadow` attribute
5. **Template processing** - Calls `this._process(fragment)` for expression evaluation

**Lifecycle:**

```
constructor → added() → render() → renderValue()
                ↓
            effect created
                ↓
        model property changed
                ↓
            render() again
                ↓
        disconnected → removed() → effect cleanup
```

**Memory management:**

- Uses `#propEffect` private field to store effect cleanup function
- Uses `#valueNodes` Map to track rendered nodes
- Both cleaned up in `removed()` lifecycle method
- No memory leaks due to proper cleanup

**Performance notes:**

- Creates one effect per component instance
- Effect tracks `this.model[this.prop]` access
- Re-renders only when tracked property changes
- Does NOT re-render on unrelated model changes

**Testing ValueComponent:**

ValueComponent is tested indirectly through PropertyComponent and RelationComponent tests:
- `test/ValueComponent.test.js` - Direct tests
- `test/PropertyComponent.test.js` - PropertyComponent behavior
- `test/RelationComponent.test.js` - RelationComponent behavior

**Note:** This component is considered part of the internal API. While it's stable and production-ready, its interface may evolve in future versions. For public API, use the declarative syntax.

---
- Value change detection and updates

**Note:** These components are fully tested and production-ready, but their internal API may change in future versions.

---

## Model

Represents semantic web resource with RDF properties.

### Constructor

```javascript
import { Model } from 'veda-client';

// Load by URI
const model = new Model('d:MyModel');
await model.load();

// Create from data
const model = new Model({
  '@': 'd:MyModel',
  'v-s:title': [{ data: 'Title', type: 'String' }]
});

// Create new
const model = new Model();
model.id = 'd:NewModel';
model['rdf:type'] = [new Model('v-s:Person')];
```

**⚠️ Important: Factory Pattern & Caching**

Model uses a factory pattern with automatic caching. Calling `new Model(uri)` multiple times with the same URI returns the **same instance**:

```javascript
const model1 = new Model('d:Person1');
const model2 = new Model('d:Person1');

console.log(model1 === model2); // true - same instance!
```

**Why this matters:**
- **State sharing:** All references to the same URI share state
- **Event listeners:** Listeners attached to one reference affect all references
- **Memory efficiency:** Only one instance per URI in memory
- **Reactivity:** Changes to the model are automatically reflected everywhere

**Example - Shared State:**

```javascript
const todo1 = new Model('d:Todo_123');
await todo1.load();

// Later, in another component
const todo2 = new Model('d:Todo_123'); // Returns same instance as todo1
console.log(todo1 === todo2); // true

todo1['v-s:title'] = ['Updated']; // Both todo1 and todo2 see this change
console.log(todo2['v-s:title']); // ['Updated']
```

**Cache location:** Models are cached in `Model.cache` (a `WeakCache` instance). When all references to a model are garbage collected, it's automatically removed from cache.

**Cache bypass:** To force reload from backend, use `model.reset()` or `model.load(false)`.

### Instance Methods

#### `load(cache?: boolean): Promise<Model>`

Load model data from backend.

```javascript
const model = new Model('d:Person1');
await model.load(); // Uses cache by default
await model.load(false); // Force reload
```

#### `save(): Promise<Model>`

Save model to backend.

```javascript
model['v-s:title'] = [{ data: 'New Title', type: 'String' }];
await model.save();
```

#### `remove(): Promise<Model>`

Remove model from backend (sets `isNew` to true).

```javascript
await model.remove();
```

#### `reset(): Promise<Model>`

Reload model data from backend, bypassing cache.

```javascript
await model.reset();
```

#### `hasValue(property: string, value?: any): boolean`

Check if property has value.

```javascript
if (model.hasValue('v-s:title')) {
  // Has title
}

if (model.hasValue('v-s:title', 'Specific Title')) {
  // Has specific title
}
```

#### `addValue(property: string, value: any): void`

Add value to property (appends to array).

```javascript
model.addValue('v-s:tag', 'important');
model.addValue('v-s:tag', 'urgent');
// Now: model['v-s:tag'] = ['important', 'urgent']
```

#### `removeValue(property: string, value: any): void`

Remove value from property.

```javascript
model.removeValue('v-s:tag', 'urgent');
```

#### `toLabel(prop?: string, lang?: string[]): string`

Get the display label for the object, respecting language preferences.

```javascript
// Default: uses rdfs:label and RU language
const label = model.toLabel();

// Custom: use v-s:title and English
const title = model.toLabel('v-s:title', ['EN']);
```

#### `getPropertyChain(...props: string[]): Promise<value>`

Traverse property chain through related models to get a value.

```javascript
// Get creator's name through chain:
// model -> v-s:creator -> v-s:name
const creatorName = await model.getPropertyChain('v-s:creator', 'v-s:name');

// Get department head's email:
// employee -> v-s:department -> v-s:head -> v-s:email
const headEmail = await employee.getPropertyChain(
  'v-s:department',
  'v-s:head',
  'v-s:email'
);
```

**Parameters:**
- `...props: string[]` - Sequence of property names to traverse

**Returns:**
- `Promise<any>` - Final value at end of chain, or `undefined` if chain breaks

**How it works:**
1. Starts with current model
2. For each property name:
   - Gets property value (first element if array)
   - If value is URI (Model instance), loads that model
   - Continues with next property on loaded model
3. Returns final value

**Array handling:**
- Always takes first element of property array: `model[prop][0]`
- To access other array elements, use manual traversal

**Chain interruption:**
- Returns `undefined` if any property doesn't exist
- Returns `undefined` if intermediate value is not a Model
- Doesn't throw errors - returns undefined gracefully

**Caching:**
- Intermediate models are loaded and cached by Model system
- Subsequent calls with same chain reuse cached models

**Use cases:**
- Accessing nested related data
- Traversing RDF graph paths
- Avoiding manual model loading chains

**Example - Manual vs Chain:**

```javascript
// ❌ Without getPropertyChain (manual)
const creatorUri = task['v-s:creator'][0];
const creator = new Model(creatorUri);
await creator.load();
const creatorName = creator['v-s:name'][0];

// ✅ With getPropertyChain (automatic)
const creatorName = await task.getPropertyChain('v-s:creator', 'v-s:name');
```

**Example - Handling missing properties:**

```javascript
// Chain may break at any point
const email = await employee.getPropertyChain('v-s:department', 'v-s:head', 'v-s:email');

if (email) {
  console.log('Head email:', email);
} else {
  console.log('Chain broke - employee has no department, or department has no head, or head has no email');
}
```

**Example - Complex chain:**

```javascript
// Multi-level traversal
const task = new Model('d:Task123');
await task.load();

// Get project manager's phone
// task -> project -> manager -> contactInfo -> phone
const phone = await task.getPropertyChain(
  'v-s:hasProject',
  'v-s:hasManager',
  'v-s:hasContactInfo',
  'v-s:phone'
);
```

**Example - Accessing URI of end model:**

```javascript
// Get the URI of the deeply nested model
const task = new Model('d:Task123');
await task.load();

// Traverse: task -> type -> type's type -> get URI
const typeUri = await task.getPropertyChain('rdf:type', 'rdf:type');
if (typeUri instanceof Model) {
  console.log('Type URI:', typeUri.id); // e.g., 'rdfs:Class'
}

// Alternative: access property directly
const typeName = await task.getPropertyChain('rdf:type', 'rdfs:label', '0');
console.log('Type name:', typeName); // Gets first label value
```

**Limitations:**
- Always uses first array element at each step
- No support for filtering or multi-value traversal
- For complex queries, use manual traversal or Backend.query()

**Performance:**
- Each step may trigger network request (if not cached)
- Use sparingly in loops - consider bulk loading instead

### Rights & Permissions

#### `canCreate(): Promise<boolean>`
Check if current user can create this type of object. Useful when called with a class individual (object of type rdfs:Class or owl:Class).

#### `canRead(): Promise<boolean>`
Check if current user can read this object.

#### `canUpdate(): Promise<boolean>`
Check if current user can update this object.

#### `canDelete(): Promise<boolean>`
Check if current user can delete this object.

### Membership

#### `loadMemberships(): Promise<Model>`
Load groups/organizations this object belongs to.

#### `isMemberOf(uri: string): Promise<boolean>`
Check if object is a member of a specific group/org.

### Properties

Properties are arrays (RDF-style):

```javascript
// Read
console.log(model['v-s:title']); // [{ data: 'Title', type: 'String' }]

// Write
model['v-s:title'] = [{ data: 'New Title', type: 'String' }];

// Check
if (model['v-s:creator']) {
  // Has creator
}
```

### Events

```javascript
model.on('modified', (property, value) => {
  console.log(`${property} changed to`, value);
});

model.on('beforeSave', (data) => {
  console.log('About to save', data);
});

model.on('afterSave', (data) => {
  console.log('Saved successfully', data);
});
```

### Real-time Updates

Use `model.subscribe()`/`model.unsubscribe()` to listen for backend push notifications via `Subscription`:

```javascript
const todo = new Model('d:Todo1');
await todo.load();

todo.subscribe(); // Registers WebSocket subscription, resets model when notified

// Later, when live updates are no longer required
todo.unsubscribe();
```

Components created with `Component(HTMLElement)` call `this.model.subscribe?.()` during `populate()`, so UI code usually gets live updates automatically whenever a model instance is present.

---

## Backend

Static class for backend communication.

### Error Handling

#### `Backend.onError(listener): () => void`

Register a global error listener for all backend errors.

```javascript
import { Backend, BackendError } from 'veda-client';

// Register global error handler
const unsubscribe = Backend.onError((error) => {
  console.error('Backend error:', error.status, error.message);

  if (error.status === 401) {
    // Redirect to login
    location.href = '/login';
  } else if (error.status === 500) {
    // Show error notification
    showNotification('Server error. Please try again.');
  }
});

// Later, remove listener
unsubscribe();
```

**Parameters:**
- `listener: (error: BackendError) => void` - Callback function receiving error

**Returns:** Unsubscribe function to remove the listener

**Use cases:**
- Global error handling and logging
- Automatic retry logic
- User notifications for errors
- Authentication error handling

**Example - Retry Logic:**

```javascript
Backend.onError((error) => {
  if (error.status === 503) { // Service unavailable
    console.log('Server busy, retrying in 5s...');
    setTimeout(() => {
      // Retry the failed request
      location.reload();
    }, 5000);
  }
});
```

**Example - Multiple Listeners:**

```javascript
// Logger
Backend.onError((error) => {
  logToAnalytics('backend_error', {
    status: error.status,
    endpoint: error.url
  });
});

// User notification
Backend.onError((error) => {
  if (error.status >= 500) {
    toast.error('Server error. Please try again.');
  }
});
```

**Note:** Error listeners are called AFTER the error is thrown, so they don't prevent error propagation. Use try/catch for per-request error handling.

### Authentication

```javascript
import { Backend } from 'veda-client';

Backend.init('http://localhost:8080');

await Backend.authenticate('username', 'password');
await Backend.logout();
```

### Individual Operations

#### Single Operations

```javascript
// Get one
const data = await Backend.get_individual('d:Person1');

// Update one (full replace)
await Backend.put_individual(data);

// Remove one
await Backend.remove_individual('d:Person1');
```

#### Batch Operations

```javascript
// Get multiple
const items = await Backend.get_individuals(['d:1', 'd:2']);

// Update multiple
await Backend.put_individuals([data1, data2]);
```

#### Atomic Operations (Concurrent Safe)

Use these methods to modify specific fields without overwriting the entire object, which is safer for concurrent multi-user access.

```javascript
// Add values (append)
await Backend.add_to_individual({
  '@': 'd:Task1',
  'v-s:comment': [{ data: 'New comment', type: 'String' }]
});

// Set values (replace specific fields)
await Backend.set_in_individual({
  '@': 'd:Task1',
  'v-s:status': [{ data: 'v-s:Completed', type: 'Uri' }]
});

// Remove values
await Backend.remove_from_individual({
  '@': 'd:Task1',
  'v-s:tag': [{ data: 'OldTag', type: 'String' }]
});
```

### Query

#### Basic Search

```javascript
const result = await Backend.query({
  query: "'rdf:type' == 'v-s:Person'",
  sort: "'v-s:created' desc",
  top: 100,
  limit: 10,
  from: 0
});

console.log(result.result); // Array of URIs
console.log(result.count);  // Total count
```

#### Advanced Search

```javascript
// Search string format: "field == 'value' && field2 == 'value2'"
const result = await Backend.query("'v-s:creator' == 'd:User1' && 'rdf:type' == 'v-s:Task'");
```

### File Upload

```javascript
await Backend.uploadFile({
  path: 'files',
  uri: 'd:File1',
  file: fileInput.files[0]
});
```

### Permissions & Metadata

```javascript
// Get effective rights
const rights = await Backend.get_rights('d:Resource1');

// Get rights origin (why I have rights)
const origin = await Backend.get_rights_origin('d:Resource1');

// Get membership info
const membership = await Backend.get_membership('d:User1');
```

---

## Subscription

WebSocket-based pub/sub channel used by `Model.subscribe()` to react to server-side changes.

### Usage

```javascript
import { Subscription, Model } from 'veda-client';

Subscription.init('ws://localhost:8088'); // Optional in browsers where defaults are derived from location

const model = new Model('d:Item1');

const callback = (id, updateCounter) => {
  console.log('Server says', id, 'changed at', updateCounter);
  model.reset(); // Pull fresh data when notified
};

Subscription.subscribe(model, [
  model.id,
  model['v-s:updateCounter']?.[0] ?? 0,
  callback
]);

// Later, clean up explicitly for deterministic teardown
Subscription.unsubscribe(model.id);
```

**Notes:**
- Outgoing subscribe/unsubscribe commands are batched with a ~500 ms delay to reduce network chatter.
- `FinalizationRegistry` automatically unsubscribes when the `ref` object is garbage-collected, but calling `unsubscribe()` is still recommended for predictable cleanup.
- Tests can inject a mock socket through `Subscription.init(address, CustomWebSocketClass)`.

---

## Router

Simple hash-based router.

```javascript
import { Router } from 'veda-client';

const router = new Router();

router.add('#/', () => {
  console.log('Home');
});

router.add('#/user/:id', (id) => {
  console.log('User ID:', id);
});

if (!location.hash) {
  location.hash = '#/';
}
router.route(location.hash);

// Handlers with multiple parameters receive positional arguments
router.add('#/section/:slug/:id', (slug, id) => {
  console.log(slug, id);
});
```

---

## Utility Functions

Helper functions for common tasks.

### `genUri(): string`

Generates unique URI for new models.

```javascript
import { genUri } from 'veda-client';

const uri = genUri();
console.log(uri); // 'd:a1b2c3d4e5f6...'
```

**Use case:** Creating new model instances with unique IDs.

### `guid(): string`

Generates globally unique identifier (26 characters, base36).

```javascript
import { guid } from 'veda-client';

const id = guid();
console.log(id); // 'a1b2c3d4e5f6g7h8i9j0k1l2m3'
```

**Note:** Uses timestamp + performance.now() for better uniqueness.

### `timeout(ms: number): Promise<void>`

Promise-based setTimeout wrapper for async/await code.

```javascript
import { timeout } from 'veda-client';

async function delayedAction() {
  console.log('Starting...');
  await timeout(1000); // Wait 1 second
  console.log('Done!');
}
```

**Use case:** Delays in async functions, animations, rate limiting.

### `diff(first: object, second: object): string[]`

Returns array of property names that differ between two objects.

```javascript
import { diff } from 'veda-client';

const obj1 = { a: 1, b: 2, c: 3 };
const obj2 = { a: 1, b: 999, d: 4 };

const changes = diff(obj1, obj2);
console.log(changes); // ['b', 'c', 'd']
```

**Features:**
- Deep comparison (uses `eq()` internally)
- Detects added, removed, and modified properties
- Works with nested objects

**Use case:** Change detection, model diffing before save.

### `eq(first: any, second: any): boolean`

Deep equality comparison for any values.

```javascript
import { eq } from 'veda-client';

// Primitives
eq(42, 42);           // true
eq('hello', 'world'); // false

// Objects (deep comparison)
eq({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }); // true
eq({ a: 1 }, { a: 2 });                            // false

// Arrays
eq([1, 2, 3], [1, 2, 3]); // true
```

**Note:** Compares object properties recursively, not references.

### `dashToCamel(str: string): string`

Converts dash-case to camelCase.

```javascript
import { dashToCamel } from 'veda-client';

dashToCamel('my-component-name');  // 'myComponentName'
dashToCamel('data-attr');          // 'dataAttr'
dashToCamel('already-camel');      // 'alreadyCamel'
```

**Use case:** Converting HTML attribute names to JavaScript property names.

### `decorator(fn, pre?, post?, err?)`

Universal function decorator (auto-detects async/sync).

```javascript
import { decorator } from 'veda-client';

const myFunction = decorator(
  function action(x) {
    return x * 2;
  },
  function pre(x) {
    console.log('Before:', x);
  },
  function post(x) {
    console.log('After:', x);
  },
  function err(error) {
    console.error('Error:', error);
  }
);

myFunction(5);
// Logs: "Before: 5"
// Returns: 10
// Logs: "After: 5"
```

**Parameters:**
- `fn` - Function to decorate
- `pre` - Called before fn (optional)
- `post` - Called after fn (optional)
- `err` - Error handler (optional)

**Note:** Automatically uses `asyncDecorator` or `syncDecorator` based on function type.

### `asyncDecorator(fn, pre?, post?, err?)`

Decorator for async functions with lifecycle hooks.

```javascript
import { asyncDecorator } from './src/Util.js';

const saveWithHooks = asyncDecorator(
  async function save(data) {
    return await backend.save(data);
  },
  async function beforeSave(data) {
    this.emit('beforeSave', data);
  },
  async function afterSave(data) {
    this.emit('afterSave', data);
  },
  async function onError(error) {
    console.error('Save failed:', error);
  }
);
```

**Use case:** Adding lifecycle hooks to Model methods (used internally).

### `syncDecorator(fn, pre?, post?, err?)`

Decorator for synchronous functions with lifecycle hooks.

```javascript
import { syncDecorator } from './src/Util.js';

const validatedGetter = syncDecorator(
  function getValue(key) {
    return this.data[key];
  },
  function validate(key) {
    if (!key) throw new Error('Key required');
  }
);
```

**Use case:** Adding validation, logging, or side effects to synchronous operations.

---

## Value

RDF value serialization/deserialization utility.

### Constructor

```javascript
import { Value } from 'veda-client';

// Create from data and type
const value = new Value('John', 'String', 'EN');
const number = new Value(42, 'Integer');
const date = new Value('2024-01-01T00:00:00Z', 'Datetime');
```

### Static Methods

#### `Value.serialize(value): Value`

Auto-detects type and creates Value object.

```javascript
Value.serialize(42);              // Value { data: 42, type: 'Integer' }
Value.serialize(3.14);            // Value { data: '3.14', type: 'Decimal' }
Value.serialize(true);            // Value { data: true, type: 'Boolean' }
Value.serialize(new Date());      // Value { data: '...Z', type: 'Datetime' }
Value.serialize('d:Person1');     // Value { data: 'd:Person1', type: 'Uri' }
Value.serialize('Hello');         // Value { data: 'Hello', type: 'String' }
Value.serialize('Title^^EN');     // Value { data: 'Title', type: 'String', lang: 'EN' }
```

#### `Value.parse(value): any`

Converts Value object to JavaScript type.

```javascript
Value.parse({ data: 'Hello', type: 'String' });           // 'Hello'
Value.parse({ data: 'Title', type: 'String', lang: 'EN' }); // 'Title^^EN'
Value.parse({ data: 42, type: 'Integer' });               // 42
Value.parse({ data: '3.14', type: 'Decimal' });           // 3.14
Value.parse({ data: true, type: 'Boolean' });             // true
Value.parse({ data: '2024-01-01T00:00:00Z', type: 'Datetime' }); // Date object
Value.parse({ data: 'd:Person1', type: 'Uri' });          // Model instance
```

#### `Value.areEqual(first, second): boolean`

Compares two Value objects.

```javascript
const v1 = new Value('Hello', 'String');
const v2 = new Value('Hello', 'String');
Value.areEqual(v1, v2); // true

const v3 = new Value('Hello', 'String', 'EN');
Value.areEqual(v1, v3); // false (different lang)
```

### Instance Methods

#### `isEqual(value): boolean`

```javascript
const v1 = new Value(42, 'Integer');
const v2 = new Value(42, 'Integer');
v1.isEqual(v2); // true
```

### Properties

```javascript
const value = new Value('Hello', 'String', 'EN');
console.log(value.data);  // 'Hello'
console.log(value.type);  // 'String'
console.log(value.lang);  // 'EN'
```

### Supported Types

| Type | JavaScript | Example |
|------|------------|---------|
| `String` | string | `'Hello'` |
| `Integer` | number | `42` |
| `Decimal` | number | `3.14` |
| `Boolean` | boolean | `true` |
| `Datetime` | Date | `new Date()` |
| `Uri` | Model | `new Model('d:Entity')` |

---

## WeakCache

Weak reference cache for temporary object storage.

### Usage

```javascript
import { WeakCache } from 'veda-client';

const cache = new WeakCache();

// Set value
const obj = { data: 'value' };
cache.set('key', obj);

// Get value
cache.get('key'); // obj

// Check existence
cache.has('key'); // true

// Delete (automatic when obj is garbage collected)
cache.delete('key');
```

**Use case:** Model caching, temporary component state.

---

## Emitter

Event emitter mixin for adding pub/sub capabilities to classes.

### Usage

```javascript
import { Emitter } from 'veda-client';

// Apply to a class
class MyClass extends Emitter(Object) {
  constructor() {
    super();
  }

  doSomething() {
    // Emit event
    this.emit('done', { result: 'success' });
  }
}

const instance = new MyClass();

// Subscribe to events
instance.on('done', (data) => {
  console.log('Event fired:', data);
});

instance.doSomething(); // Logs: "Event fired: { result: 'success' }"
```

### Methods

#### `on(events: string, fn: Function): this`

Subscribe to one or more events (space-separated).

```javascript
// Single event
obj.on('save', handler);

// Multiple events
obj.on('save delete', handler);

// Multiple calls stack
obj.on('save', handler1);
obj.on('save', handler2); // Both will be called
```

#### `off(events: string, fn?: Function): this`

Unsubscribe from events.

```javascript
// Remove specific handler
obj.off('save', handler);

// Remove all handlers for event
obj.off('save');

// Remove all handlers for multiple events
obj.off('save delete');
```

#### `one(event: string, fn: Function): this`

Subscribe to event, auto-unsubscribe after first fire.

```javascript
obj.one('load', () => {
  console.log('Loaded once');
});

obj.emit('load'); // Logs: "Loaded once"
obj.emit('load'); // No log - already unsubscribed
```

#### `once(event: string, fn: Function): this`

Alias for `one()`.

```javascript
obj.once('init', handler);
```

#### `emit(event: string, ...args: any[]): this`

Emit event with arguments.

```javascript
obj.emit('save', model, options);

// Handlers receive all arguments
obj.on('save', (model, options) => {
  console.log('Saving', model, options);
});
```

#### `trigger(event: string, ...args: any[]): this`

Alias for `emit()`.

```javascript
obj.trigger('change', newValue);
```

### Usage in Model

`Model` uses `Emitter` internally for reactivity:

```javascript
model.on('modified', (property, value) => {
  console.log(`${property} changed to`, value);
});

model.on('beforeSave', () => {
  console.log('About to save');
});

model.on('afterSave', () => {
  console.log('Saved successfully');
});

model['v-s:title'] = ['New Title'];
// Logs: "v-s:title changed to ['New Title']"
// Logs: "modified changed to v-s:title ['New Title']"

await model.save();
// Logs: "About to save"
// Logs: "Saved successfully"
```

### Event Naming Convention

Model events follow a pattern:

```javascript
// Property-specific
model.on('v-s:title', handler);     // Fires when v-s:title changes

// Generic
model.on('modified', handler);       // Fires on any property change

// Lifecycle
model.on('beforeload', handler);
model.on('afterload', handler);
model.on('beforesave', handler);
model.on('aftersave', handler);
model.on('beforereset', handler);
model.on('afterreset', handler);
model.on('beforeremove', handler);
model.on('afterremove', handler);
```

### Error Handling

Event handlers can throw - errors are not caught:

```javascript
obj.on('event', () => {
  throw new Error('Handler error');
});

try {
  obj.emit('event'); // Throws
} catch (error) {
  console.error('Event handler failed:', error);
}
```

**Best practice:** Handle errors inside event handlers.

### Memory Management

Handlers are automatically cleaned up when the object is garbage collected. For manual cleanup:

```javascript
const handler = (data) => console.log(data);

obj.on('event', handler);

// Later...
obj.off('event', handler); // Clean up
```

**Component usage:** Component automatically cleans up event listeners on disconnect.

---

## BackendError

Custom error class for Backend API errors.

### Usage

```javascript
import { Backend, BackendError } from 'veda-client';

try {
  await Backend.get_individual('invalid:id');
} catch (error) {
  if (error instanceof BackendError) {
    console.log('Status:', error.status);      // HTTP status code
    console.log('Message:', error.message);    // Error message
    console.log('Response:', error.response);  // Raw response
  }
}
```

### Properties

```javascript
error.status    // HTTP status code (e.g., 404, 500)
error.message   // Error description
error.response  // Raw server response
```

---

## TypeScript

Full TypeScript definitions included.

### Configuration

**tsconfig.json** for Veda Client projects:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "node",
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key settings:**
- `target: "ES2020"` - Modern JavaScript features (Proxy, WeakMap)
- `module: "ES2020"` - ES modules
- `lib: ["DOM"]` - Custom Elements, browser APIs
- `strict: true` - Full type checking

### Importing Types

```typescript
// Import values and types
import Component, { html } from 'veda-client';
import { Model } from 'veda-client';
import { Loop, If } from 'veda-client';

// Import types only
import type { ComponentInstance } from 'veda-client';
import type { Reactive } from 'veda-client';
import type { ModelValue } from 'veda-client';
import type { EmitterInstance } from 'veda-client';
```

### Component with Types

**Example with RDF properties (real-world usage):**

```typescript
import Component, { html } from 'veda-client';
import { Model } from 'veda-client';
import type { Reactive } from 'veda-client';
import type { ModelValue } from 'veda-client';

// Define RDF model interface
interface TodoModel extends Model {
  ['v-s:title']?: ModelValue[];
  ['v-s:completed']?: ModelValue[];
  ['v-s:created']?: ModelValue[];
}

// Component state interface
interface TodoState {
  todos: TodoModel[];
  filter: 'all' | 'active' | 'completed';
  editing: boolean;
}

class TodoApp extends Component(HTMLElement) {
  state!: Reactive<TodoState>;

  constructor() {
    super();
    this.state.todos = [];
    this.state.filter = 'all';
    this.state.editing = false;
  }

  get filteredTodos() {
    return this.state.todos.filter(todo => {
      const completed = todo['v-s:completed']?.[0]?.data || false;
      return this.state.filter === 'all' ||
        (this.state.filter === 'active' && !completed) ||
        (this.state.filter === 'completed' && completed);
    });
  }

  render() {
    return html`<div>...</div>`;
  }
}
```

**Simplified example (for quick prototyping):**

```typescript
interface TodoState {
  todos: Array<{ id: number; text: string; done: boolean }>;
  filter: 'all' | 'active' | 'completed';
}

class TodoApp extends Component(HTMLElement) {
  state!: Reactive<TodoState>;

  constructor() {
    super();
    this.state.todos = [];
    this.state.filter = 'all';
  }

  get filteredTodos() {
    return this.state.todos.filter(t =>
      this.state.filter === 'all' ||
      (this.state.filter === 'active' && !t.done) ||
      (this.state.filter === 'completed' && t.done)
    );
  }

  render() {
    return html`<div>...</div>`;
  }
}
```

### Model with Types

**Recommended: Define RDF property interfaces**

```typescript
import { Model } from 'veda-client';
import type { ModelValue } from 'veda-client';

// Define typed model interface
interface TodoModel extends Model {
  ['v-s:title']?: ModelValue[];
  ['v-s:completed']?: ModelValue[];
  ['v-s:priority']?: ModelValue[];
  ['v-s:created']?: ModelValue[];
  ['v-s:assignedTo']?: Model[];  // Relation to another model
}

const todo = new Model('d:Todo_12345') as TodoModel;
await todo.load();

// Type-safe property access
if (todo['v-s:title']) {
  const title = todo['v-s:title'][0].data;  // Type: string | number | boolean
  console.log('Title:', title);
}

// Setting properties with type safety
todo['v-s:title'] = [{ data: 'New Title', type: 'String' }];
todo['v-s:completed'] = [{ data: true, type: 'Boolean' }];

// Relation properties
if (todo['v-s:assignedTo']) {
  const assignee = todo['v-s:assignedTo'][0];  // Type: Model
  await assignee.load();
  console.log('Assigned to:', assignee['v-s:name']?.[0]?.data);
}

await todo.save();
```

**Using getPropertyChain with types:**

```typescript
interface PersonModel extends Model {
  ['v-s:name']?: ModelValue[];
  ['v-s:email']?: ModelValue[];
  ['v-s:department']?: Model[];
}

interface DepartmentModel extends Model {
  ['v-s:title']?: ModelValue[];
  ['v-s:head']?: Model[];
}

const employee = new Model('d:Employee_123') as PersonModel;
await employee.load();

// Type-safe property chain traversal
const headEmail = await employee.getPropertyChain(
  'v-s:department',
  'v-s:head',
  'v-s:email'
);

if (headEmail) {
  console.log('Department head email:', headEmail.data);
}
```

### Generic Types for Components

**With RDF Model types:**

```typescript
import Component from 'veda-client';
import { Model } from 'veda-client';
import type { Reactive } from 'veda-client';
import type { ModelValue } from 'veda-client';

// Define RDF Model interface
interface TodoModel extends Model {
  ['v-s:title']?: ModelValue[];
  ['v-s:completed']?: ModelValue[];
  ['v-s:priority']?: ModelValue[];
}

// Component state interface
interface TodoState {
  editing: boolean;
  editText: string;
}

// Type-safe component
class TodoItem extends Component(HTMLLIElement) {
  declare model: TodoModel;  // Override model type
  state!: Reactive<TodoState>;

  constructor() {
    super();
    this.state.editing = false;
    this.state.editText = '';
  }

  get title(): string {
    return this.state.model?.['v-s:title']?.[0]?.data as string ?? '';
  }

  get completed(): boolean {
    return this.model?.['v-s:completed']?.[0]?.data as boolean ?? false;
  }

  get priority(): number {
    return this.model?.['v-s:priority']?.[0]?.data as number ?? 0;
  }
}
```

### Type-Safe Model Properties

**Using ModelValue type for RDF properties:**

```typescript
import type { ModelValue } from 'veda-client';

// Helper type for property arrays
type RDFProperty<T> = ModelValue[];

// Model interfaces with typed properties
interface PersonModel extends Model {
  ['v-s:name']: RDFProperty<string>;
  ['v-s:age']: RDFProperty<number>;
  ['v-s:isActive']: RDFProperty<boolean>;
  ['v-s:email']: RDFProperty<string>;
  ['v-s:department']: Model[];  // Relation
}

const person = new Model('d:Person_123') as PersonModel;
await person.load();

// Type-safe access
const name = person['v-s:name'][0].data;  // Type: string | number | boolean
const age = person['v-s:age'][0].data as number;
const isActive = person['v-s:isActive'][0].data as boolean;

// Type-safe setting
person['v-s:name'] = [{ data: 'John Doe', type: 'String' }];
person['v-s:age'] = [{ data: 30, type: 'Integer' }];
person['v-s:isActive'] = [{ data: true, type: 'Boolean' }];
```

**Alternative: Strongly typed properties:**

```typescript
// More strict typing for specific value types
type StringProperty = Array<{ data: string; type: 'String' }>;
type IntegerProperty = Array<{ data: number; type: 'Integer' }>;
type BooleanProperty = Array<{ data: boolean; type: 'Boolean' }>;

interface TypedPerson extends Model {
  ['v-s:name']: StringProperty;
  ['v-s:age']: IntegerProperty;
  ['v-s:isActive']: BooleanProperty;
}

const typedPerson = new Model() as TypedPerson;
typedPerson['v-s:name'] = [{ data: 'John', type: 'String' }];  // ✅
// @ts-expect-error
typedPerson['v-s:name'] = [{ data: 123, type: 'Integer' }];     // ❌ Type error
```

### Type-Safe Reactive State

```typescript
import { reactive } from 'veda-client';
import type { Reactive } from 'veda-client';

interface AppState {
  count: number;
  user: {
    name: string;
    email: string;
  };
  items: string[];
}

// Type-safe reactive state
const state: Reactive<AppState> = reactive<AppState>({
  count: 0,
  user: {
    name: 'Alice',
    email: 'alice@example.com'
  },
  items: []
});

// TypeScript infers types
state.count++;               // OK
state.user.name = 'Bob';     // OK
state.items.push('new');     // OK
// @ts-expect-error
state.count = 'invalid';     // Error: Type 'string' not assignable to 'number'
```

### Type-Safe Effect and Watch

```typescript
import { effect } from 'veda-client';

interface CounterState {
  count: number;
  doubled: number;
}

const state = reactive<CounterState>({
  count: 0,
  doubled: 0
});

// Type-safe effect
effect(() => {
  // TypeScript knows types
  const count: number = state.count;
  const doubled: number = count * 2;
  state.doubled = doubled;
});

// Type-safe watch
class MyComponent extends Component(HTMLElement) {
  state!: Reactive<CounterState>;

  async connectedCallback() {
    await super.connectedCallback();

    this.watch<number>(
      () => this.state.count,
      (newValue: number, oldValue: number | undefined) => {
        console.log(`Count: ${oldValue} -> ${newValue}`);
      }
    );
  }
}
```

### Type-Safe Loop Component

```typescript
import Component, { html, Loop } from 'veda-client';
import type { Reactive } from 'veda-client';

// Define item type
interface TodoItem {
  id: number;
  text: string;
  done: boolean;
}

// Component state interface
interface TodoListState {
  todos: TodoItem[];
  filter: 'all' | 'active' | 'completed';
}

class TodoList extends Component(HTMLElement) {
  state!: Reactive<TodoListState>;

  constructor() {
    super();
    this.state.todos = [
      { id: 1, text: 'Learn TypeScript', done: false },
      { id: 2, text: 'Build app', done: true }
    ];
    this.state.filter = 'all';
  }

  // Typed getter
  get filteredTodos(): TodoItem[] {
    const { todos, filter } = this.state;
    if (filter === 'active') return todos.filter(t => !t.done);
    if (filter === 'completed') return todos.filter(t => t.done);
    return todos;
  }

  render() {
    return html`
      <ul>
        <${Loop} items="{this.filteredTodos}" key="id" as="item">
          <li>
            <span>{this.model.text}</span>
            <span>{this.model.done ? '✓' : '○'}</span>
          </li>
        </${Loop}>
      </ul>
    `;
  }
}
```

### Type-Safe watch() Helper

```typescript
import Component, { html } from 'veda-client';
import type { Reactive } from 'veda-client';

interface EditableState {
  editing: boolean;
  value: string;
  savedValue: string;
}

class EditableField extends Component(HTMLElement) {
  state!: Reactive<EditableState>;

  constructor() {
    super();
    this.state.editing = false;
    this.state.value = '';
    this.state.savedValue = '';
  }

  async connectedCallback() {
    await super.connectedCallback();

    // Type-safe watch with explicit type annotation
    this.watch<boolean>(
      () => this.state.editing,
      (editing: boolean, wasEditing: boolean | undefined) => {
        if (editing) {
          // Entering edit mode
          this.classList.add('editing');
          const input = this.querySelector<HTMLInputElement>('input');
          input?.focus();
        } else {
          // Exiting edit mode
          this.classList.remove('editing');
        }
      },
      { immediate: true }
    );

    // Watch for value changes (with type inference)
    this.watch(
      () => this.state.value,
      (newValue, oldValue) => {
        // TypeScript infers string type
        console.log(`Value changed: "${oldValue}" -> "${newValue}"`);
      }
    );

    // Watch array length
    this.watch<number>(
      () => this.state.value.length,
      (newLen: number, oldLen: number | undefined) => {
        const maxLen = 100;
        if (newLen > maxLen) {
          console.warn(`Value too long: ${newLen}/${maxLen}`);
        }
      }
    );
  }

  render() {
    return html`
      <div>
        <input value="{this.state.value}" />
        <button onclick="{this.handleSave}">Save</button>
      </div>
    `;
  }

  handleSave() {
    this.state.savedValue = this.state.value;
    this.state.editing = false;
  }
}
```

### Type Definitions Reference

All type definitions available in `.d.ts` files:

```typescript
// Core types
import type { Reactive, ReactiveOptions } from 'veda-client';
import type { ComponentInstance, ComponentConstructor } from 'veda-client';
import type { LoopComponentInstance } from 'veda-client';
import type { IfComponentInstance } from 'veda-client';
import type { EmitterInstance } from 'veda-client';
import type { ModelValue } from 'veda-client';

// Backend types
import type {
  IndividualData,
  AuthResult,
  QueryResult,
  QueryParams,
  UploadFileParams
} from 'veda-client';

// Value types
import type {
  ValueData,
  ValueType,
  PrimitiveValue
} from 'veda-client';
```

### Common TypeScript Patterns

#### Custom Element with Typed Model

```typescript
interface ProjectModel extends Model {
  ['v-s:title']: ModelValue[];
  ['v-s:description']: ModelValue[];
  ['v-s:members']: Model[];
}

class ProjectCard extends Component(HTMLElement) {
  declare model: ProjectModel;

  get title(): string {
    return this.model['v-s:title']?.[0]?.data as string ?? '';
  }

  render() {
    return html`
      <h2>{this.title}</h2>
    `;
  }
}
```

#### Type-Safe Event Emitter

```typescript
import { Emitter } from 'veda-client';
import type { EmitterInstance } from 'veda-client';

interface Events {
  save: [model: Model, options?: object];
  delete: [id: string];
  error: [error: Error];
}

class TypedEmitter extends Emitter(Object) {
  // Type-safe emit
  emit<K extends keyof Events>(
    event: K,
    ...args: Events[K]
  ): this {
    return super.emit(event, ...args);
  }

  // Type-safe on
  on<K extends keyof Events>(
    event: K,
    fn: (...args: Events[K]) => void
  ): this {
    return super.on(event, fn);
  }
}

const emitter = new TypedEmitter();

// Type-safe usage
emitter.on('save', (model, options) => {
  // model: Model, options: object | undefined
});

emitter.emit('save', new Model(), { force: true }); // OK
// @ts-expect-error
emitter.emit('save', 'invalid');  // Error: wrong type
```

### VSCode Configuration

**.vscode/settings.json** for better development experience:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "javascript.preferences.importModuleSpecifier": "relative"
}
```

### Troubleshooting

**Issue:** Type errors with RDF property names

```typescript
// ❌ Error: Property 'v-s:title' does not exist
model['v-s:title']

// ✅ Solution: Extend Model with interface
interface MyModel extends Model {
  ['v-s:title']?: ModelValue[];
}
const model = new Model() as MyModel;
```

**Issue:** Reactive type not inferring correctly

```typescript
// ❌ Type is 'any'
const state = reactive({ count: 0 });

// ✅ Explicitly type
interface State { count: number }
const state = reactive<State>({ count: 0 });

// ✅ Or use type annotation
const state: Reactive<{ count: number }> = reactive({ count: 0 });
```

**Issue:** Component methods not typed

```typescript
// ❌ 'this' type is unknown
class MyComponent extends Component(HTMLElement) {
  myMethod() {
    this.state; // Type error
  }
}

// ✅ Declare state type
class MyComponent extends Component(HTMLElement) {
  state!: Reactive<{ count: number }>;

  constructor() {
    super();
    this.state.count = 0;
  }

  myMethod() {
    this.state.count++; // OK
  }
}
```

---

**See also:**
- [Reactivity Guide](./REACTIVITY.md) - Comprehensive reactivity tutorial
- [Limitations](./LIMITATIONS.md) - Known limitations and performance
- [Security](./SECURITY.md) - Security best practices
