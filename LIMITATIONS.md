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

### Loop Component Benchmarks (Measured)

**Initial Render:**
| Items | Time (ms) | Notes |
|-------|-----------|-------|
| 100   | ~31       | Excellent performance |
| 500   | ~50       | Good performance |
| 1000  | ~79       | Acceptable for static lists |

**Operations:**
| Operation | Items | Time (ms) | Notes |
|-----------|-------|-----------|-------|
| Add       | 100→200 | ~9    | Fast incremental addition |
| Remove    | 500→250 | ~8    | Fast removal |
| Reorder   | 100     | ~2    | Very fast for small lists |
| Reorder   | 500     | ~17   | Acceptable |
| Reorder   | 1000    | 53.62 | Noticeable delay (O(n²)) |
| Update    | 500     | ~7    | Fast value updates |
| Mixed     | 500     | ~9    | Combined operations efficient |

**Key Findings:**
- Initial render scales linearly (~0.08ms per item)
- Add/remove operations are fast (independent of list size)
- **Reordering scales quadratically** (~0.05ms per item²)
- Updates/removals have minimal overhead

**Recommendation based on benchmarks:**
- **< 100 items:** Excellent, no concerns
- **100-500 items:** Good, reordering takes 2-17ms
- **500-1000 items:** Use cautiously, reordering takes 17-54ms
- **1000+ items:** Avoid or use pagination, reordering >50ms

**Bundle sizes:**
- Browser: 48 KB (minified, platform: 'browser')
- Node.js: 82 KB (minified, platform: 'node', includes ws)

---

## Known Limitations

### 1. Loop Component - Naive Reconciliation

**Issue:** Uses simple key-based reconciliation without LIS optimization.

**Impact:**
- Reordering large lists has O(n²) DOM operations
- Reversing 1000 items = ~54ms (measured)
- Reversing 500 items = ~17ms (measured)
- Reversing 100 items = ~2ms (measured)

**Benchmark Results:**
```
Reorder (100 items):   2.31ms  ✓ Excellent
Reorder (500 items):  17.24ms  ✓ Good
Reorder (1000 items): 53.62ms  ⚠ Noticeable
```

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

### 4. Watch Uses Reference Equality

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

**Workarounds:**
1. **Watch specific property:** `this.watch(() => state.items.length, ...)`
2. **Watch nested value:** `this.watch(() => state.user.name, ...)`
3. **Reassign after mutation:** `state.items.push(x); state.items = state.items.slice();`
4. **Use effect() instead:** `this.effect(() => { console.log(state.items.length); })`

**Why:** Reference equality (`===`) is fast and predictable. Deep equality checking would be expensive and could cause unexpected triggers.

**Tests:** See `test/WatchReferenceEquality.test.js` for comprehensive examples

**Status:** By design (performance and predictability)

### 5. Component Tree Depth Limits

**Issue:** Component method search and parent context search have hard-coded depth limits to prevent infinite loops and performance issues.

**Limits:**
- **Method search depth:** 20 levels (Component.js line 460)
  - For event handler method lookup (e.g., `onclick="{handleClick}"`)
  - Why 20? Covers deeply nested component hierarchies while preventing infinite loops
  - Typical apps use 3-8 levels, max reasonable depth is ~15 levels

- **Loop parent context depth:** 10 levels (LoopComponent.js line 237)
  - For finding parent component context in Loop/If components
  - Why 10? Lower limit because Loop should be close to its data source component
  - Why different from 20? Loop context search is more performance-critical (runs per item)

**What happens at limit:**
- Method search: Handler silently fails, console warning logged
- Context search: Returns null, Loop/If may not have access to parent data

**Impact:**
- Method handlers won't work if component is nested >20 levels deep
- Loop components won't find parent context if nested >10 levels deep

**Example of problem:**
```javascript
// 21 levels deep - method search fails
<div>
  <component-1>
    <component-2>
      <!-- ... 18 more levels ... -->
      <component-21>
        <button onclick="{handleClick}">
          <!-- ❌ Won't find handleClick (depth > 20) -->
        </button>
      </component-21>
    </component-2>
  </component-1>
</div>
```

**Workaround:**
- Keep component nesting shallow (< 10-15 levels)
- For deep trees, pass methods explicitly via props:
  ```javascript
  <deep-child :onClick="{this.handleClick}"></deep-child>
  ```
- Refactor deeply nested structures (usually indicates design issues)

**Why these specific limits:**
1. **Prevent infinite loops:** Circular DOM structures (rare but possible with Shadow DOM/slots)
2. **Performance:** Limit DOM tree traversal cost (O(n) search per lookup)
3. **Design smell:** Deep nesting >15 levels usually indicates architectural problems
4. **Different use cases:** Method search is less common (20 is generous), context search is per-item (10 is safer)

**Status:** Documented limitation (intentional safeguard). If you hit these limits, your component architecture likely needs refactoring.

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
<${Loop} items="{this.items}" key="id" as="item">
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

<${Loop} items="{this.currentPage}" key="id" as="item">
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

1. **Add key attribute to all Loops** - Enables efficient reconciliation
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
