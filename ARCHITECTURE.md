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

### Circular References

The reactivity system handles circular references automatically using WeakMap caching:

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

**Why this matters:**
- Critical for RDF data where circular references are common
- Model relationships often form cycles (A → B → A)
- No need for manual cycle detection

**Implementation:**
```javascript
// src/Reactive.js lines 23-28
const existingProxy = reactiveMap.get(target);
if (existingProxy) {
  return existingProxy; // Return cached proxy
}
```

**Test coverage:**
- `test/Reactive.test.js` lines 580-631 cover various circular reference scenarios
- Self-references, nested cycles, multiple refs to same object
- Array circular references

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

Component state is automatically reactive. Each `{expression}` is owned by its
Part and gets one internal effect. Part effects are stopped when the
TemplateInstance is destroyed.

### Template Compilation and Parts

Since the template engine update the render pipeline is template-based:

```
render() → TemplateResult {strings, values}
        → compileTemplate() (cached per call-site)
        → CompiledTemplate: <template> + text markers + element groups
        → TemplateInstance: cloned DOM + Part objects
        → Part.setValues() / effect → minimal DOM write
```

- `html` returns a `TemplateResult` object, not a String. Mount it with
  `render(result, container)` or from `Component.render()`.
- A `${}` value never becomes markup: it is a text, attribute, property,
  event or spread value written through the DOM API. Name positions accept
  only authored names, Component classes or `unsafeStatic()`.
- `${attrs}` applies an object of attributes through the DOM API; framework
  attributes, `on*` content attributes, `srcdoc` and `javascript:` URLs are
  refused.
- `{}` expressions stay reactive and are compiled into Parts (text,
  attribute, property, event, ref, bind).
- ChildParts use random text markers; element Parts use a random marker
  attribute and never rely on DOM paths, so data cannot forge or shift one.
- On `update()` with the same template, the existing DOM tree and child
  components are reused and only changed Parts are written. Nested
  `TemplateResult` instances are reused too.
- `nothing`, `noChange` and `unsafeHTML` follow the Lit-style sentinel model.
- The legacy `_process()` walker was removed in 4.0; rendering always goes
  through compiled templates and Parts.
- Full details and current limitations: [TEMPLATE_ENGINE.md](./TEMPLATE_ENGINE.md).

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

**Parser (unified `{expr}` syntax with auto-detection):**

*Simple property paths (auto-detected):*
- Supports: property access, optional chaining, numeric array access (via dot)
- Security: no eval/Function, CSP-compatible

*Complex expressions (auto-detected):*
- Supports: full JavaScript expressions (operators, methods, ternary, etc.)
- Uses: `new Function()` internally
- Security: requires `unsafe-eval` CSP, sanitizes results to prevent injection

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

**Algorithm Details:**

**Phase 1: Build New Items Map** - O(n)
```javascript
newItems.forEach((item, index) => {
  const key = getKey(item, keyAttr, index);

  // Duplicate key detection
  if (newItemsMap.has(key)) {
    console.warn('Duplicate key:', key);
  }

  newKeys.add(key);
  newItemsMap.set(key, {item, index});
});
```

**Phase 2: Remove Old Items** - O(m), m = old items count
```javascript
for (const [key, {element}] of this.#itemsMap) {
  if (!newKeys.has(key)) {
    element.remove();           // DOM removal
    this.#itemsMap.delete(key); // Map cleanup
  }
}
```

**Phase 3: Reorder with LIS** - O(n log n) positions, O(n) DOM moves
```javascript
// positions of the new keys in the old order
const positions = [];
for (const key of newKeys) {
  if (oldKeySet.has(key)) positions.push(oldKeyIndex.get(key));
}

// keys already in a valid relative order do not move
const stablePositions = new Set(
  this.#longestIncreasingSubsequence(positions).map(i => positions[i]),
);
const stableKeys = new Set(
  newKeys.filter(key => stablePositions.has(oldKeyIndex.get(key))),
);

// walk backwards and place each unstable element before its successor
let nextSibling = null;
for (let i = newKeys.length - 1; i >= 0; i--) {
  const key = newKeys[i];
  const element = this.#itemsMap.get(key)?.element;
  if (!element) continue;
  if (!oldKeySet.has(key) || !stableKeys.has(key)) {
    this.insertBefore(element, nextSibling); // insertBefore(el, null) === append
  }
  nextSibling = element;
}
```

The real implementation skips a move when the element already sits before
`nextSibling` (`element.nextSibling !== nextSibling`). The map is then rebuilt
in the new order (`#rememberOrder`), so the next reconcile sees the order that
was just applied.

**Complexity Analysis:**

| Operation | Complexity | Measured (500 items) | Notes |
|-----------|-----------|---------------------|-------|
| Add items | O(n) | ~11ms | Create n new elements |
| Remove items | O(m) | ~8ms | Remove m old elements |
| Update items | O(n) | ~11ms | Update n changed items |
| Reorder items | O(n log n) | ~21ms | LIS keeps already ordered nodes in place |

**Benchmark Results (2026-11-16, 4.0.0):**
- 100 items reorder: 3.59ms
- 500 items reorder: 20.98ms
- 1000 items reorder: 48.40ms

**Why LIS:** only nodes outside the longest increasing subsequence move, so a
sort or a single insertion produces the minimum number of DOM moves. Reordering
remains the most expensive Loop operation, but it is no longer quadratic.

**Memory Usage:**
- `#itemsMap`: O(n) - stores element references
- Element references are strong references (GC only on remove)
- No memory leaks: old elements properly cleaned up in Phase 2

**Duplicate Key Handling:**

```javascript
const key = this.#getKey(item, keyAttr, index);

if (newItemsMap.has(key)) {
  console.warn(
    `Loop component: Duplicate key "${key}" found.`,
    'Each item in the list must have a unique key.',
    'Current item:', item,
    'Previous item:', newItemsMap.get(key).item
  );
}
```

Duplicate keys are logged but don't break reconciliation. Last item with duplicate key wins.

**Algorithm:** O(n) for additions/removals, O(n log n) for reordering via LIS.

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

| Operation | Complexity | Measured | Notes |
|-----------|-----------|----------|-------|
| Property access | O(1) | 0.17μs | Proxy overhead ~10% |
| Effect trigger | O(n) | 0.9ms/1000 | n = dependent effects |
| Loop add/remove | O(n) | 8-11ms/500 | n = items |
| Loop reorder | O(n log n) | 21ms/500 | LIS algorithm |
| Computed access | O(1) | <0.001ms | When cached |
| Component create | O(1) | 0.12ms | Per component |
| Component update | O(1) | 0.002ms | Per update |

**Benchmark source:** `test/benchmarks/LoopPerformance.test.js` and `test/benchmarks/Performance.test.js` (2026-11-16 run)

## Comparison with Other Frameworks

| Feature | Veda | Vue 3 | Solid.js | React |
|---------|------|-------|----------|-------|
| Reactivity | Proxy | Proxy | Signals | Hooks |
| Updates | Fine-grained | VDOM | Fine-grained | VDOM |
| Bundle | ~41 KB (gzip) | ~80 KB | ~15 KB | ~130 KB |
| API | Simple | Medium | Simple | Complex |
| RDF Support | Native | Plugin | Plugin | Plugin |

## Extending the Framework

### Custom Reactive Components

```javascript
class MyReactive extends Component(HTMLElement) {
  constructor() {
    super();
    this.state.todos = [];
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

