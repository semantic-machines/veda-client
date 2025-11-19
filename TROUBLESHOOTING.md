# Troubleshooting Guide

Common issues and solutions for Veda Client Framework.

---

## Reactivity Issues

### Components Not Updating

**Symptom:**
```javascript
this.state.count++;
// Component doesn't re-render
```

**Causes & Solutions:**

1. **Not using `this.reactive()`**

```javascript
// ❌ Wrong
constructor() {
  super();
  this.state = { count: 0 }; // Plain object
}

// ✅ Correct
constructor() {
  super();
  this.state = this.reactive({ count: 0 });
}
```

2. **Array mutations not reactive**

```javascript
// ❌ Won't trigger update
this.state.items[0] = newValue;

// ✅ Use array methods
this.state.items.splice(0, 1, newValue);

// ✅ Or reassign
this.state.items = [...this.state.items];
```

3. **Watch not triggering on array/object changes**

```javascript
// ❌ Same reference, won't trigger
this.watch(() => this.state.items, callback);
this.state.items.push(x); // No trigger

// ✅ Watch specific property
this.watch(() => this.state.items.length, callback);

// ✅ Or reassign array
this.state.items = [...this.state.items, x]; // Triggers!
```

---

## Loop Component Issues

### Loop Not Updating

**Symptom:**
```javascript
this.state.todos.push(newTodo);
// Loop doesn't show new item
```

**Solution:** Loop needs array reference change:

```javascript
// ❌ Direct mutation
this.state.todos.push(newTodo);

// ✅ Create new array reference
this.state.todos = [...this.state.todos, newTodo];
```

### Loop Re-rendering All Items

**Symptom:** All items flash/re-render when adding one item.

**Cause:** Missing `item-key` attribute.

```javascript
// ❌ No key - re-renders everything
<${Loop} items="{this.todos}">

// ✅ With key - efficient reconciliation
<${Loop} items="{this.todos}" item-key="id">
```

### Loop Performance Slow (>500 items)

**Solution:** Use pagination or virtualization:

```javascript
// Paginate
get currentPage() {
  const { page, pageSize } = this.state;
  return this.allItems.slice(
    page * pageSize,
    (page + 1) * pageSize
  );
}

<${Loop} items="{this.currentPage}" item-key="id">
```

---

## Expression Parser Errors

### "Unexpected token" in Template

**Symptom:**
```javascript
<div>{this.count + 1}</div>
// Error: Unexpected token '+'
```

**Cause:** Expression parser only supports property access.

**Solution:** Use computed properties (getters):

```javascript
get incrementedCount() {
  return this.count + 1;
}

render() {
  return html`<div>{this.incrementedCount}</div>`;
}
```

---

## Model Issues

### Model Properties Not Reactive

**Symptom:** State changes don't update UI.

**Solution:** Component must use `this.reactive()`:

```javascript
constructor() {
  super();
  this.state = this.reactive({}); // Enables model reactivity
}
```

**How it works:**
- Without `this.reactive()`: component ignores state changes
- With `this.reactive()`: component subscribes to state updates

### Model Load Fails Silently

**Check:**

```javascript
try {
  const model = await Model.load('d:NonExistent');
} catch (error) {
  console.error('Load failed:', error);
  // Handle error
}
```

---

## Effect Issues

### Infinite Loop Error

**Symptom:**
```
Error: Infinite loop detected: Effect triggered 100 times
```

**Cause:** Effect modifies state it depends on:

```javascript
// ❌ Creates infinite loop
effect(() => {
  this.state.count++; // Modifies what it reads
});
```

**Solution:** Separate read/write:

```javascript
// ✅ Read from one, write to another
effect(() => {
  this.state.doubled = this.state.count * 2;
});
```

### Effects Not Running in Tests

**Symptom:**
```javascript
state.count = 5;
console.log(derived); // Still old value
```

**Cause:** Effects are async (microtask).

**Solution:** Use `flushEffects()`:

```javascript
import { flushEffects } from './src/Effect.js';

state.count = 5;
await flushEffects(); // Wait for effects
console.log(derived); // Updated value
```

---

## Performance Issues

### Slow Rendering (>1 second)

**Check:**

1. **Too many items in Loop** (>500)
   - Solution: Pagination or virtualization

2. **Missing `item-key`**
   - Solution: Add `item-key="id"`

3. **Complex computed properties**
   ```javascript
   // ❌ Heavy computation on every access
   get expensiveValue() {
     return this.items.map(heavy_operation); // Runs often!
   }

   // ✅ Cache in reactive state
   constructor() {
     super();
     this.state = this.reactive({ cached: [] });
   }

   effect(() => {
     this.state.cached = this.items.map(heavy_operation); // Runs once
   });
   ```

### Memory Leaks

**Check:**

1. **Effects not cleaned up**
   ```javascript
   // ✅ Use this.effect() - auto-cleanup
   connectedCallback() {
     this.effect(() => {
       // Auto-cleaned on disconnect
     });
   }

   // ❌ Manual effect - must cleanup
   const cleanup = effect(() => {});
   // Need to call cleanup() manually!
   ```

2. **Event listeners not removed**
   ```javascript
   connectedCallback() {
     this.handler = () => {...};
     window.addEventListener('resize', this.handler);
   }

   disconnectedCallback() {
     window.removeEventListener('resize', this.handler); // Don't forget!
     super.disconnectedCallback();
   }
   ```

---

## TypeScript Issues

### Property Access Type Errors

**Symptom:**
```typescript
model['v-s:title'] // Error: Element implicitly has 'any' type
```

**Solution:** Define interface:

```typescript
interface TodoModel extends Model {
  ['v-s:title']?: Array<{ data: string; type: string }>;
}

const todo = new Model('d:Todo1') as TodoModel;
```

---

## Browser Compatibility

### Components Not Working in Safari

**Check:** Safari 14+ required.

**Test:**
```javascript
// Check Custom Elements support
if (!window.customElements) {
  console.error('Custom Elements not supported');
}

// Check Proxy support
if (typeof Proxy === 'undefined') {
  console.error('Proxy not supported');
}
```

---

## Debugging Tips

### Enable Reactive Tracking

```javascript
// Add to component
effect(() => {
  console.log('State changed:', JSON.stringify(this.state));
});
```

### Log Render Calls

```javascript
render() {
  console.log('Rendering', this.constructor.name, this.state);
  return html`...`;
}
```

### Inspect Reactive State

```javascript
// Check if object is reactive
console.log(obj.__isReactive); // Should be true
```

### Use Browser DevTools

1. **Component tree:** Use Custom Elements in Elements panel
2. **Breakpoints:** Set in render() and effect()
3. **Console:** Check for warnings about dangerous props, infinite loops

---

## Common Pitfalls

### 1. Forgetting `await` on Async Lifecycle

```javascript
// ❌ Can cause race conditions
async connectedCallback() {
  super.connectedCallback(); // Missing await!
  this.doSomething();
}

// ✅ Always await
async connectedCallback() {
  await super.connectedCallback();
  this.doSomething();
}
```

### 2. Modifying State in `render()`

```javascript
// ❌ NEVER modify state in render
render() {
  this.state.count++; // Infinite loop!
  return html`...`;
}

// ✅ Keep render() pure
render() {
  return html`<div>{this.state.count}</div>`;
}
```

### 3. Using `raw` with User Input

```javascript
// ❌ XSS vulnerability
const userInput = '<script>alert(1)</script>';
return raw`<div>${userInput}</div>`; // Executed!

// ✅ Always use html for user content
return html`<div>${userInput}</div>`; // Escaped
```

---

## Getting Help

If your issue isn't listed here:

1. **Check existing documentation:**
   - [API.md](./API.md) - Complete API reference
   - [REACTIVITY.md](./REACTIVITY.md) - Reactivity guide
   - [LIMITATIONS.md](./LIMITATIONS.md) - Known limitations

2. **Search issues:**
   - [GitHub Issues](https://github.com/semantic-machines/veda-client/issues)

3. **Ask for help:**
   - Open a new issue with:
     - Minimal reproducible example
     - Expected vs actual behavior
     - Browser/version information
     - Error messages/stack traces

4. **Join community:**
   - Discussions tab on GitHub

---

**Remember:** Most issues come from:
1. Not using `this.reactive()` for reactive state
2. Missing `item-key` in Loop components
3. Forgetting array mutations need new references
4. Using complex expressions in templates (use getters instead)

