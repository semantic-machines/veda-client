# Veda Client Limitations & Best Practices

This document outlines when to use **Veda Client Core** vs **Framework Adapters** (React/Solid).

---

## 🎯 Quick Decision Guide

### ✅ Use Veda Client Core when:

- **Simple forms** (10-100 fields)
- **Small lists** (< 200 items)
- **RDFa-first** applications
- **Minimal dependencies** preferred
- **Bundle size** is critical
- **Learning curve** should be minimal

### ⚠️ Use Framework Adapters when:

- **Large lists** (1000+ items, need virtualization)
- **Complex tables** (sorting, filtering, pagination)
- **Real-time dashboards** (frequent updates)
- **Rich text editors** or complex widgets
- **Existing React/Solid** codebase
- **Team expertise** in specific framework

---

## 📊 Performance Characteristics

### Veda Client Core

| Scenario | Performance | Notes |
|----------|-------------|-------|
| Small lists (< 100) | Excellent | Key-based reconciliation works well |
| Medium lists (100-500) | Good | Acceptable performance |
| Large lists (500-1000) | Moderate | May feel sluggish |
| Huge lists (1000+) | Poor | Use React adapter + virtualization |
| Simple forms | Excellent | Fine-grained reactivity shines |
| Conditional rendering | Good | Efficient add/remove from DOM |
| Nested components | Good | Automatic reactivity propagation |

**Bundle size:** 40.2kb (minified)

### React Adapter

| Scenario | Performance | Notes |
|----------|-------------|-------|
| Large lists (1000+) | Excellent | With react-virtualized |
| Complex tables | Excellent | Full React ecosystem |
| Rich editors | Excellent | Use existing React components |
| Bundle overhead | ~55-60kb | React + adapter |

### Solid Adapter

| Scenario | Performance | Notes |
|----------|-------------|-------|
| Real-time updates | Excellent | Fine-grained reactivity |
| Large lists | Excellent | With solid-virtual |
| Reactive dashboards | Excellent | No VDOM overhead |
| Bundle overhead | ~50-55kb | Solid + adapter |

---

## 🐛 Known Limitations (Core)

### 1. Loop Component

#### ⚠️ Naive Reconciliation Algorithm

**Issue:**
- Uses simple key-based reconciliation
- Does NOT use "Longest Increasing Subsequence" (LIS) optimization
- Reordering large lists has O(n²) DOM operations

**Impact:**
```javascript
// Example: reverse 1000 items
items.reverse();

// Veda Core: ~1000 insertBefore() calls
// React with LIS: ~500 moves (optimal)
```

**Workaround:**
- Avoid frequent reordering of large lists (> 500 items)
- Use React adapter for complex list manipulations

**Status:** Documented limitation (MVP), may optimize in future if needed

---

#### ⚠️ No Virtualization

**Issue:**
- Renders ALL items in the list
- No windowing/virtualization support

**Impact:**
```javascript
<veda-loop items="{10000items}">
  // Renders 10,000 DOM nodes!
  // Memory: ~50-100MB
  // Scroll: janky
</veda-loop>
```

**Workaround:**
- Paginate lists > 500 items
- Use React adapter + react-virtualized for huge lists

**Status:** Documented limitation (use adapter for this case)

---

#### ⚠️ Multiple Children Wrapping

**Issue:**
- Multiple children get wrapped in extra `<div>`

```javascript
<veda-loop items="{items}">
  <template>
    <span>Title</span>
    <span>Description</span>
  </template>
</veda-loop>

// Renders:
<div>
  <span>Title</span>
  <span>Description</span>
</div>
// ❌ Extra wrapper div!
```

**Workaround:**
- Use single root element in template
- Or accept the wrapper div

**Status:** Will be fixed in Phase 1.1

---

### 2. If Component

#### ⚠️ Limited Expression Syntax

**Issue:**
- No complex expressions in `condition` attribute
- Only simple property access

```javascript
// ✅ GOOD:
<veda-if condition="{this.isVisible}">

// ❌ BAD (not supported):
<veda-if condition="{this.count > 5 && this.isActive}">

// ✅ Workaround - use computed:
get shouldShow() {
  return this.count > 5 && this.isActive;
}
<veda-if condition="{this.shouldShow}">
```

**Status:** Documented limitation (use computed properties)

---

### 3. Expression Evaluation

#### ✅ Safe Expression Parser (FIXED)

**Solution:**
- All expression evaluation now uses `ExpressionParser`
- Supports only safe dot notation: `model.property.0.nested`
- No operators, no function calls, no code execution possible

```javascript
// ✅ SAFE - supported:
<div class="{this.model.id}">
<veda-if condition="{this.model.items.0}">
<veda-loop items="{this.model.v-s:hasTodo}">

// ❌ NOT supported (and that's GOOD for security):
<div onclick="{alert('XSS')}">       // Won't execute
<veda-if condition="{1 + 1}">         // Won't work
<veda-loop items="{getItems()}">     // Won't work

// ✅ Workaround - use computed/methods:
get itemCount() {
  return this.items.length;
}
<div>{this.itemCount}</div>
```

**Status:** ✅ SECURE - ExpressionParser used everywhere

---

#### ⚠️ Limited Expression Syntax

**Issue:**
- No complex expressions in templates
- No ternary operators, no function calls

```javascript
// ❌ NOT supported:
<div class="{item.active ? 'active' : 'inactive'}">
<div>{formatDate(item.created)}</div>

// ✅ Workaround - use computed:
get itemClass() {
  return this.item.active ? 'active' : 'inactive';
}
<div class="{this.itemClass}">
```

**Status:** Documented limitation (use computed properties)

---

#### ⚠️ HTML Sanitization (safe() function)

**Issue:**
- The `safe()` function escapes HTML **and removes ALL `{}`** characters
- This is intentional (prevents expression injection) but affects edge cases

```javascript
// ❌ Issue:
safe('Style: { color: red }');    // Returns: 'Style: '
safe('JSON: {"key": "value"}');   // Returns: 'JSON: '
safe('Code: function() {}');      // Returns: 'Code: function() '

// ✅ Workaround - use raw():
raw`Style: { color: red }`;       // Preserves {}
raw`JSON: {"key": "value"}`;      // Preserves {}
```

**When this matters:**
- Displaying JSON in UI
- Showing CSS snippets  
- Code examples with object literals
- Mathematical notation with sets

**Workaround:**
```javascript
// Use raw() for content that should not be sanitized
render() {
  return html`
    <pre>${raw`{ "json": "example" }`}</pre>
    <code>${raw`const obj = { key: 'value' };`}</code>
  `;
}
```

**Status:** Documented limitation (use `raw()` when displaying code/JSON)

---

### 4. Reactivity

#### ⚠️ Array Index Assignment

**Issue:**
- Array index assignment NOT reactive

```javascript
const state = reactive({ items: [1, 2, 3] });

// ❌ NOT reactive:
state.items[0] = 99;

// ✅ Use mutation methods:
state.items.splice(0, 1, 99);
// Or reassign:
state.items = [...state.items];
```

**Workaround:**
- Use array mutation methods (`push`, `splice`, etc.)
- Or reassign entire array

**Status:** Documented limitation (same as Vue 3)

---

#### ⚠️ Nested Object Reactivity

**Issue:**
- New properties added to reactive objects NOT reactive

```javascript
const state = reactive({ user: { name: 'John' } });

// ❌ NOT reactive:
state.user.age = 30;

// ✅ Use reactive for nested:
state.user = reactive({ ...state.user, age: 30 });
```

**Workaround:**
- Wrap nested objects in `reactive()`
- Or use `Object.assign()` or spread

**Status:** Documented limitation (same as Vue 3)

---

### 5. Model Integration

#### ⚠️ Value Structure Complexity

**Issue:**
- RDF values have complex structure: `{ data, type, lang }`
- Verbose for simple cases

```javascript
// ❌ Verbose:
model['v-s:title'] = [{ data: 'New Title', type: 'String', lang: 'en' }];

// ✅ Use Value helper:
model['v-s:title'] = [new Value('New Title', 'String', 'en')];

// ✅ Or shorthand (if implemented):
model.setTitle('New Title', 'en');
```

**Workaround:**
- Use `Value` class
- Or create model-specific helpers

**Status:** Acceptable (RDF semantics preserved)

---

## 📋 Best Practices

### 1. Choose the Right Tool

```javascript
// ✅ Good: Simple form with Core
<form>
  <input value="{model['v-s:title'][0].data}">
  <veda-if condition="{this.showDetails}">
    <div>{model['rdfs:comment'][0].data}</div>
  </veda-if>
</form>

// ❌ Bad: Large table with Core
<veda-loop items="{10000rows}">
  // Renders 10k DOM nodes, slow!
</veda-loop>

// ✅ Good: Large table with React adapter
import { useVedaRelation } from '@veda/react-adapter';
import { Virtuoso } from 'react-virtuoso';

function Table() {
  const rows = useVedaRelation(model, 'v-s:hasRow');
  return <Virtuoso data={rows} itemContent={Row} />;
}
```

---

### 2. Optimize List Rendering

```javascript
// ❌ Bad: Re-render on every change
<veda-loop items="{this.allItems}">

// ✅ Good: Filter with computed
get visibleItems() {
  return this.allItems.filter(i => i.visible);
}
<veda-loop items="{this.visibleItems}">

// ✅ Good: Paginate large lists
get currentPage() {
  return this.allItems.slice(this.page * 50, (this.page + 1) * 50);
}
<veda-loop items="{this.currentPage}">
```

---

### 3. Use Computed Properties

```javascript
// ❌ Bad: Complex expressions in template
<div class="{item.status === 'active' && item.priority > 5 ? 'urgent' : 'normal'}">

// ✅ Good: Computed property
get itemClass() {
  return this.item.status === 'active' && this.item.priority > 5 
    ? 'urgent' 
    : 'normal';
}
<div class="{this.itemClass}">
```

---

### 4. Avoid Nested Loops

```javascript
// ❌ Bad: Nested loops (O(n²))
<veda-loop items="{this.categories}">
  <veda-loop items="{category.items}">
    // Slow for large datasets
  </veda-loop>
</veda-loop>

// ✅ Good: Flatten data
get flatItems() {
  return this.categories.flatMap(c => c.items);
}
<veda-loop items="{this.flatItems}">

// ✅ Or use React adapter for complex hierarchies
```

---

### 5. Cleanup Effects

```javascript
// ❌ Bad: No cleanup
effect(() => {
  const timer = setInterval(() => fetch(), 1000);
  // Timer leaks when component unmounts!
});

// ✅ Good: Return cleanup function
effect(() => {
  const timer = setInterval(() => fetch(), 1000);
  return () => clearInterval(timer);
});
```

---

### 6. Batch Model Updates

```javascript
// ❌ Bad: Multiple updates
todos.forEach(todo => {
  todo['v-s:completed'] = [true];
  // Triggers effect for EACH todo
});

// ✅ Good: Batch updates
const updates = todos.map(todo => {
  todo['v-s:completed'] = [true];
  return todo.save();
});
await Promise.all(updates);
// Then trigger single update:
this.state.todos = [...this.state.todos];
```

---

## 🔄 Migration Path

### From Core to React Adapter

**When to migrate:**
- List grows > 500 items
- Need complex interactions (drag-drop, etc.)
- Need existing React components
- Team has React expertise

**How:**
```javascript
// Before (Core):
class TodoList extends Component(HTMLElement) {
  render() {
    return html`
      <veda-loop items="{this.todos}">
        <todo-item></todo-item>
      </veda-loop>
    `;
  }
}

// After (React adapter):
import { useVedaRelation } from '@veda/react-adapter';

function TodoList({ model }) {
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

### From Core to Solid Adapter

**When to migrate:**
- Need real-time updates (WebSocket, SSE)
- Performance critical (dashboards)
- Fine-grained reactivity important

**How:**
```javascript
// Before (Core):
class Dashboard extends Component(HTMLElement) {
  render() {
    return html`<div>{this.stats.count}</div>`;
  }
}

// After (Solid adapter):
import { createVedaProperty } from '@veda/solid-adapter';

function Dashboard(props) {
  const [count] = createVedaProperty(props.model, 'v-s:count');
  
  return <div>{count()}</div>;
}
```

**Effort:** Low (models stay same, only UI changes)

---

## 📚 Additional Resources

- [REACTIVITY.md](./REACTIVITY.md) - Core reactivity concepts
- [LOOP_IF_COMPONENTS.md](./LOOP_IF_COMPONENTS.md) - Loop/If usage
- [ROADMAP.md](./ROADMAP.md) - Development roadmap
- [MIGRATION_REACTIVE.md](./MIGRATION_REACTIVE.md) - Migration guide

---

## 🤔 Need Help?

**Decision tree:**

```
Do you have < 200 items in lists?
├─ Yes → Use Core
└─ No
   └─ Do you need virtualization?
      ├─ Yes → Use React/Solid adapter
      └─ No → Can you paginate?
         ├─ Yes → Use Core with pagination
         └─ No → Use React/Solid adapter
```

**Still unsure?** Start with Core. Migrate to adapter only when needed. Models stay the same!

---

**Last updated:** Phase 1.0
**Status:** Living document (will be updated as limitations are fixed)

