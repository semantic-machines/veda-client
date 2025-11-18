# Architecture Guide

Understanding how Veda Client Framework works under the hood.

## Overview

Veda Client is a reactive framework built on three core systems:

1. **Reactivity System** (Reactive.js, Effect.js)
2. **Component System** (Component.js, Custom Elements)
3. **Data Layer** (Model.js, Backend.js)

## Reactivity System

### Proxy-Based Tracking

The reactivity system uses ES6 Proxy to intercept property access:

```javascript
const proxy = new Proxy(target, {
  get(target, key) {
    track(target, key);  // Record dependency
    return Reflect.get(target, key);
  },
  set(target, key, value) {
    Reflect.set(target, key, value);
    trigger(target, key);  // Notify dependents
    return true;
  }
});
```

**Why Proxy?**
- Deep reactivity: nested objects automatically wrapped
- Array method interception: push/pop/splice trigger updates
- Minimal overhead: only wraps accessed properties

**Trade-offs:**
- Can't proxy primitives (strings, numbers)
- IE11 not supported (Proxy can't be polyfilled)
- WeakMap prevents memory leaks

### Effect System

Effects automatically track dependencies during execution:

```javascript
effect(() => {
  console.log(state.count);  // Tracked!
});

state.count++;  // Effect re-runs
```

**How it works:**

1. Effect starts → set activeEffect
2. Code runs → accesses state.count
3. Getter calls track(state, 'count')
4. track() records: state.count → activeEffect
5. Later: state.count = 5 → trigger(state, 'count')
6. trigger() queues all dependent effects
7. Microtask runs → flushEffects()

**Batching:**
Multiple changes queue only one flush:

```javascript
state.a = 1;
state.b = 2;
state.c = 3;
// Single microtask → runs all effects once
```

**Infinite Loop Protection:**
Max 100 triggers per effect per flush cycle:

```javascript
effect(() => {
  state.count++;  // Modifies what it reads
});
// After 100 iterations: Error thrown
```

### Computed Values

Computed values cache results and re-compute when dependencies change:

```javascript
const doubled = computed(() => state.count * 2);
console.log(doubled.value);  // Computed once
console.log(doubled.value);  // Cached
state.count++;
console.log(doubled.value);  // Re-computed
```

**Implementation:**
- Lazy evaluation (computed on first access)
- Dirty flag (marks stale when dependencies change)
- Computed effects run before regular effects (computed: true option)

## Component System

### Lifecycle

```
constructor → connectedCallback → populate → added → update → render → post
                                                                          ↓
                                                                   childrenRendered
                                                                          ↓
                                                                  renderedCallback
```

**Reactive Integration:**

When component uses this.reactive():
1. Sets internal flag: #isReactive = true
2. Creates effect for each {expression} in template
3. Stores effects in #renderEffects for cleanup
4. Cleanup on disconnect or re-render

### Expression Processing

Template expressions `{this.count}` are parsed and bound:

```javascript
// Template: <div>{this.count}</div>
// Becomes: text node with effect

effect(() => {
  const value = ExpressionParser.evaluate('this.count', component);
  textNode.textContent = String(value);
});
```

**Parser:**
- Supports: property access, optional chaining, bracket notation
- Rejects: operators, function calls, ternaries
- Security: prevents eval/Function injection

### Loop Reconciliation

Loop component uses key-based reconciliation:

```javascript
// Old items: [A, B, C]
// New items: [A, C, D]

1. Build newKeys Set and newItemsMap Map
2. Remove B (not in newKeys)
3. Reuse A and C (same key)
4. Create D (new key)
5. Reorder: A → C → D
```

**Algorithm:** O(n) for additions/removals, O(n²) for reordering
**Why not LIS?** MVP simplicity. May optimize if benchmarks show need.

## Data Layer

### Model System

Models are semantic web resources with RDF properties:

```javascript
model['v-s:title'] = [{ data: 'Title', type: 'String' }];
```

**Reactivity Integration:**
- Model events trigger reactive updates
- Component.reactive() enables auto-subscription
- Effect tracks model property access

### Backend Communication

```
Component → Model → Backend → WebSocket/HTTP → Server
    ↓        ↓
 Reactive   Cache
```

**Caching:**
- WeakCache for loaded models
- Automatic cleanup when no references

## Design Decisions

### Why Proxy over Getter/Setter?

**Advantages:**
- Deep reactivity without manual nesting
- Array methods just work
- Dynamic property addition

**Disadvantages:**
- No IE11 support
- Slight performance overhead

### Why Async Effects?

**Before (sync):**
```javascript
state.a = 1;  // Effect runs
state.b = 2;  // Effect runs
state.c = 3;  // Effect runs (3 DOM updates!)
```

**After (async):**
```javascript
state.a = 1;  // Queued
state.b = 2;  // Queued
state.c = 3;  // Queued
// Microtask: flush once (1 DOM update!)
```

### Why No Virtual DOM?

**Veda approach:** Fine-grained reactivity
- Update only changed text nodes/attributes
- No diffing overhead
- Smaller bundle

**Trade-off:** More complex reconciliation for large lists

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Property access | O(1) | Proxy overhead ~10% |
| Effect trigger | O(n) | n = dependent effects |
| Loop add/remove | O(n) | n = items |
| Loop reorder | O(n²) | Naive algorithm |
| Computed access | O(1) | When cached |

## Comparison with Other Frameworks

| Feature | Veda | Vue 3 | Solid.js | React |
|---------|------|-------|----------|-------|
| Reactivity | Proxy | Proxy | Signals | Hooks |
| Updates | Fine-grained | VDOM | Fine-grained | VDOM |
| Bundle | 48 KB | ~80 KB | ~15 KB | ~130 KB |
| API | Simple | Medium | Simple | Complex |
| RDF Support | Native | Plugin | Plugin | Plugin |

## Extending the Framework

### Custom Reactive Components

```javascript
class MyReactive extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({
      // Your state
    });
  }

  // Automatic reactivity enabled
}
```

### Custom Effects

```javascript
// Debounced effect
let timeout;
effect(() => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    console.log(state.query);
  }, 300);
});
```

## Further Reading

- [Reactivity Guide](./REACTIVITY.md) - User-facing reactivity documentation
- [API Reference](./API.md) - Complete API documentation
- Vue 3 Reactivity: https://vuejs.org/guide/extras/reactivity-in-depth.html
- Proxy MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy

