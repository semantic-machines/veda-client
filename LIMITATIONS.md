# Limitations & Performance

Known limitations and when to use alternatives.

## Quick Decision Guide

### ✅ Use Veda Client When

- Simple to medium forms (10-500 fields)
- Lists < 500 items
- RDF/semantic data applications
- Minimal dependencies preferred
- Bundle size critical (48 KB)
- Learning curve should be minimal

### ⚠️ Consider Alternatives When

- Large lists (1000+ items) - need virtualization
- Complex tables with sorting/filtering/pagination
- Real-time dashboards with frequent updates
- Rich text editors or complex widgets
- Team already expert in React/Vue/Angular

---

## Performance Characteristics

| Scenario | Performance | Notes |
|----------|-------------|-------|
| Lists < 100 items | Excellent | Key-based reconciliation works well |
| Lists 100-500 | Good | Acceptable performance |
| Lists 500-1000 | Moderate | May feel sluggish on reorder |
| Lists 1000+ | Poor | Use virtualization library |
| Simple forms | Excellent | Fine-grained reactivity shines |
| Conditional rendering | Good | Efficient DOM add/remove |
| Nested components | Good | Automatic reactivity propagation |

**Bundle sizes:**
- Browser: 48 KB (minified, platform: 'browser')
- Node.js: 82 KB (minified, platform: 'node', includes ws)

---

## Known Limitations

### 1. Loop Component - Naive Reconciliation

**Issue:** Uses simple key-based reconciliation without LIS optimization.

**Impact:**
- Reordering large lists has O(n²) DOM operations
- Reversing 1000 items = ~1000 insertBefore() calls

**Workaround:**
- Avoid frequent reordering of large lists (> 500 items)
- Use pagination for large datasets
- Consider virtualization library for 1000+ items

**Status:** Documented limitation (MVP), may optimize if needed

### 2. No Virtualization

**Issue:** Renders ALL items in list.

**Impact:**
- 10,000 items = 10,000 DOM nodes
- Memory: ~50-100MB for large lists
- Slow scrolling

**Workaround:**
- Paginate lists > 500 items
- Use intersection observer for lazy loading
- Consider react-virtualized or similar

**Status:** Use pagination or external library

### 3. Expression Parser - Limited Syntax

**Issue:** Only property access supported, no operators.

```javascript
// ✅ Supported
{this.user.name}
{this.items.0.title}
{this.model.v-s:title.0}

// ❌ Not supported
{this.count + 1}
{this.isActive ? 'Yes' : 'No'}
{this.formatDate(date)}
```

**Workaround:** Use computed properties (getters)

```javascript
get incrementedCount() {
  return this.count + 1;
}

<div>{this.incrementedCount}</div>
```

**Status:** By design (security and simplicity)

### 4. Array Index Assignment Not Reactive

**Issue:**
```javascript
const state = reactive({ items: [1, 2, 3] });

// ❌ NOT reactive
state.items[0] = 99;

// ✅ Reactive
state.items.splice(0, 1, 99);
state.items = [...state.items]; // Or reassign
```

**Workaround:** Use array mutation methods or reassignment

**Why:** Intercepting numeric keys has performance implications and adds complexity. Use array mutation methods instead.

**Status:** Veda-specific limitation (unlike Vue 3 which tracks index assignment via Proxy)

### 5. Watch Uses Reference Equality

**Issue:**
```javascript
// ❌ Won't trigger - same array reference
this.watch(() => state.items, callback);
state.items.push(4); // No trigger!

// ✅ Triggers
state.items = [...state.items, 4];

// ✅ Or watch length
this.watch(() => state.items.length, callback);
```

**Status:** By design (performance)

### 6. Component Tree Depth Limits

**Issue:** Component method search and parent context search have hard-coded depth limits.

**Limits:**
- **Method search depth:** 20 levels (Component.js line 460)
  ```javascript
  #findMethod(name) {
    let depth = 0;
    while (parent && depth < 20) { // Hard limit
  ```

- **Loop parent context depth:** 10 levels (LoopComponent.js line 237)
  ```javascript
  #findParentComponent() {
    let depth = 0;
    while (context && depth < 10) { // Hard limit
  ```

**Impact:**
- Method handlers won't work if component is nested >20 levels deep
- Loop components won't find parent context if nested >10 levels deep

**Workaround:**
- Keep component nesting shallow (< 10-15 levels)
- For deep trees, pass methods explicitly via props
- Refactor deeply nested structures

**Why limits exist:**
- Prevent infinite loops in circular DOM structures
- Performance optimization (limit tree traversal)
- Deep nesting is usually a design smell

**Status:** Documented limitation (intentional safeguard)

---

## Best Practices

### 1. Use Computed for Logic

```javascript
// ❌ Bad - won't work
<div>{this.a > this.b ? this.a : this.b}</div>

// ✅ Good
get max() {
  return Math.max(this.a, this.b);
}
<div>{this.max}</div>
```

### 2. Add Keys to Loop

```javascript
// ❌ Poor performance
<${Loop} items="{this.items}">

// ✅ Optimized reconciliation
<${Loop} items="{this.items}" item-key="id">
```

### 3. Paginate Large Lists

```javascript
get currentPage() {
  const { page, pageSize } = this.state;
  return this.allItems.slice(
    page * pageSize,
    (page + 1) * pageSize
  );
}

<${Loop} items="{this.currentPage}" item-key="id">
```

### 4. Batch Model Updates

```javascript
// ❌ Bad - multiple triggers
todos.forEach(todo => {
  todo['v-s:completed'] = [true];
});

// ✅ Good - batch updates
const updates = todos.map(t => {
  t['v-s:completed'] = [true];
  return t.save();
});
await Promise.all(updates);
this.state.todos = [...this.state.todos]; // Single trigger
```

---

## Security Limitations

### safe() Removes All Braces

The `safe()` function removes `{}` characters to prevent expression injection:

```javascript
safe('Style: { color: red }');    // Returns: 'Style: '
safe('JSON: {"key": "value"}');   // Returns: 'JSON: '
```

**Workaround:** Use `raw()` for code/JSON display (with trusted content only):

```javascript
render() {
  return html`
    <pre>${raw`{ "json": "example" }`}</pre>
    <code>${raw`const obj = { key: 'value' };`}</code>
  `;
}
```

---

## Browser Support

**Minimum versions:**
- Chrome/Edge 88+ (Jan 2021)
- Firefox 85+ (Jan 2021)
- Safari 14+ (Sep 2020)

**Required features:**
- Custom Elements v1
- ES Modules
- Proxy
- WeakMap

**Not supported:**
- IE 11
- Old mobile browsers

---

## Performance Tips

1. **Add item-key to all Loops** - Enables efficient reconciliation
2. **Use computed properties** - Cache expensive calculations
3. **Paginate large lists** - Don't render 1000+ items
4. **Batch state changes** - Automatic batching via microtask
5. **Use Shadow DOM** - Style isolation without global CSS overhead

---

## When to Use Alternatives

### Use React/Vue/Solid When

You need:
- Virtualization (1000+ items)
- Complex drag-and-drop
- Rich text editors
- Large existing ecosystem
- Team expertise in specific framework

### Migration Path

Veda models work with any framework:

```javascript
// React example
import { useVedaModel } from '@veda/react-adapter'; // Future

function TodoList() {
  const model = useVedaModel('d:TodoList');
  const todos = useVedaRelation(model, 'v-s:hasTodo');

  return (
    <div>
      {todos.map(todo => (
        <TodoItem key={todo.id} model={todo} />
      ))}
    </div>
  );
}
```

**Effort:** Low (models stay same, only UI changes)

---

## Summary

**Veda Client strengths:**
- ✅ Small bundle (48 KB)
- ✅ Simple API
- ✅ RDF/semantic data
- ✅ Good for forms and small lists

**Limitations:**
- ❌ No virtualization
- ❌ Naive reconciliation
- ❌ Limited expression syntax

**Decision rule:**
- < 500 items → Use Veda Client
- 500-1000 items → Consider pagination
- 1000+ items → Use React/Vue + virtualization

---

**See also:**
- [Performance Benchmarks](./test/benchmarks/)
- [Roadmap](./ROADMAP.md) - Future improvements
- [API Reference](./API.md) - Complete API docs
