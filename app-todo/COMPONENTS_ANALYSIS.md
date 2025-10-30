# Veda Framework Components - Complete Analysis

## 📊 Component Comparison Matrix

| Component | Purpose | Syntax | Use Case | Pros | Cons |
|-----------|---------|--------|----------|------|------|
| **Loop** | List rendering | `<Loop items="{arr}">` | Interactive lists | Full control, reconciliation | More JavaScript |
| **If** | Conditional | `<If condition="{bool}">` | Show/hide content | Reactive, efficient | Requires template wrap |
| **property** | Display value | `<span property="prop">` | Simple values | Minimal code, auto-reactive | Limited to model properties |
| **rel** | Related models | `<div rel="prop">` | Model relationships | Auto-iteration, declarative | Less control |

---

## 🎯 TodoMVC: Two Approaches Compared

### Code Metrics

| Metric | Imperative (Loop) | Declarative (property/rel) |
|--------|-------------------|---------------------------|
| **TodoApp lines** | 243 | 172 |
| **TodoItem lines** | 120 | 161 |
| **Total JS** | ~500 LOC | ~450 LOC |
| **Template complexity** | Medium | Low |
| **JavaScript logic** | More | Less |
| **Model coupling** | Loose | Tight |

### Architecture Differences

#### Imperative (Loop)
```
TodoApp
  ├── state.filter (local)
  ├── model['v-s:hasTodo'] (source)
  └── Loop → TodoItem (manual props)
        ├── Renders {this.title}
        └── Uses reactive expressions
```

#### Declarative (property/rel)
```
TodoApp
  ├── state.filter (local)
  ├── model['v-s:hasTodo'] (source)
  └── rel="v-s:hasTodo" → TodoList → TodoItem
        ├── property="v-s:title" (automatic)
        └── Model-driven rendering
```

---

## 🔍 Deep Dive: How Components Work

### 1. Loop Component Internals

```javascript
// User code
<${Loop} items="{this.todos}" item-key="id">
  <template><todo-item></todo-item></template>
</${Loop}>

// What happens internally:
1. effect(() => {
     const items = evaluate("{this.todos}", parentContext);
     reconcile(items);  // Diff & patch DOM
   });

2. For each item:
   - Find existing element by key
   - OR create new from template
   - Set element.model = item
   - Update position in DOM

3. Remove elements for deleted items
```

**Reconciliation algorithm:**
1. Build map: `oldKeys → elements`
2. Build map: `newKeys → items`
3. For each new item:
   - Reuse element if key exists
   - Create new element if not
   - Update `element.model`
4. Remove elements for missing keys
5. Maintain correct DOM order

### 2. property Component Internals

```javascript
// User code
<span property="rdfs:label"></span>

// What happens internally:
1. effect(() => {
     const values = this.model[this.prop];
     render(values);
   });

2. For each value in array (or single value):
   - If template exists:
     - Clone template
     - Replace <slot> with value
     - Append to container
   - Else:
     - Create text node with value
```

### 3. rel Component Internals

```javascript
// User code
<div rel="v-s:hasApplication">
  <template><app-card></app-card></template>
</div>

// What happens internally:
1. effect(() => {
     const related = this.model[this.prop];  // Array of models
     renderAll(related);
   });

2. For each related model:
   - Save current this.model
   - Set this.model = relatedModel
   - Clone & process template (children get model)
   - Restore original this.model
```

### 4. If Component Internals

```javascript
// User code
<${If} condition="{this.isVisible}">
  <template>...</template>
</${If}>

// What happens internally:
1. effect(() => {
     const show = evaluate("{this.isVisible}", parentContext);
     updateVisibility(show);
   });

2. If show === true:
   - Clone template
   - Process (create components, effects)
   - Insert into DOM

3. If show === false:
   - Remove all content
   - Leave comment node as placeholder
```

---

## 🧪 Component Interaction Patterns

### Pattern 1: Nested Loops

```javascript
// Categories with items
<${Loop} items="{this.categories}" item-key="id">
  <template>
    <div>
      <h3>{this.model.name}</h3>
      <${Loop} items="{this.model.items}" item-key="id">
        <template>
          <item-card></item-card>
        </template>
      </${Loop}>
    </div>
  </template>
</${Loop}>
```

**How it works:**
1. Outer Loop: Each iteration has `model = category`
2. Inner Loop: Accesses `this.model.items` (category's items)
3. Inner Loop items: Each has `model = item`

### Pattern 2: If inside Loop

```javascript
<${Loop} items="{this.todos}" item-key="id">
  <template>
    <${If} condition="{this.model.isImportant}">
      <template>
        <important-todo></important-todo>
      </template>
    </${If}>
  </template>
</${Loop}>
```

**Evaluation context:**
- Loop provides `model = todo`
- If evaluates `{this.model.isImportant}` in Loop item context
- Children see `model = todo`

### Pattern 3: property with rel

```javascript
<div rel="v-s:hasApplication">
  <template>
    <div>
      <h3 property="rdfs:label"></h3>  <!-- From related model -->
      <p property="rdfs:comment"></p>
    </div>
  </template>
</div>
```

**Model flow:**
1. rel iterates `this.model['v-s:hasApplication']`
2. Each iteration: `this.model = app` (related model)
3. property reads `this.model['rdfs:label']`
4. Automatic reactivity on model changes

### Pattern 4: Filtering with rel

```javascript
// Problem: rel doesn't support filtering
<div rel="v-s:hasTodo">
  <template>
    <!-- How to filter here? -->
  </template>
</div>

// Solution: Wrapper component
<div rel="v-s:hasTodo">
  <template>
    <todo-filter filter="{this.currentFilter}"></todo-filter>
  </template>
</div>

// In todo-filter:
render() {
  if (this.shouldDisplay) {
    return html`<todo-item></todo-item>`;
  }
  return html``;  // Skip
}
```

---

## 🎨 Styling Strategies

### Strategy 1: Class binding

```javascript
// Imperative
<div class="{this.isActive ? 'active' : ''}">

// Better: Computed
get itemClass() {
  return this.isActive ? 'active' : '';
}
<div class="{this.itemClass}">

// Best: Effect (for complex)
this.effect(() => {
  this.classList.toggle('active', this.isActive);
});
```

### Strategy 2: Style attribute

```javascript
// Direct
<div style="color: {this.color}">

// Multiple styles (computed)
get itemStyle() {
  return `color: ${this.color}; background: ${this.bg}`;
}
<div style="{this.itemStyle}">
```

### Strategy 3: CSS Classes

```css
/* Prefer semantic classes */
.todo-item.completed { opacity: 0.6; }
.todo-item.editing { background: #ffffcc; }
```

```javascript
// Toggle in effect
this.effect(() => {
  this.classList.toggle('completed', this.isCompleted);
  this.classList.toggle('editing', this.isEditing);
});
```

---

## 📈 Performance Considerations

### Loop Component
- ✅ **Reconciliation**: Reuses DOM elements
- ✅ **Key-based**: O(n) complexity
- ⚠️ **Large lists**: Consider virtualization
- ⚠️ **Deep nesting**: Can be expensive

### property/rel Components
- ✅ **Simple**: Minimal overhead
- ✅ **Auto-reactive**: No manual tracking
- ⚠️ **Re-renders**: Full re-render on change
- ⚠️ **No reconciliation**: Recreates all nodes

### If Component
- ✅ **Lazy**: Only renders when shown
- ✅ **Cleanup**: Removes all when hidden
- ⚠️ **Recreate**: Re-creates on each show

### Optimization Tips

1. **Use item-key in Loop**
   ```javascript
   <${Loop} items="{items}" item-key="id">  // ← Always provide
   ```

2. **Memoize computed properties**
   ```javascript
   #cachedFiltered = null;
   #cachedFilter = null;

   get filteredTodos() {
     if (this.#cachedFilter !== this.state.filter) {
       this.#cachedFilter = this.state.filter;
       this.#cachedFiltered = this.todos.filter(...);
     }
     return this.#cachedFiltered;
   }
   ```

3. **Batch updates**
   ```javascript
   // ❌ Multiple updates
   this.state.a = 1;
   this.state.b = 2;
   this.state.c = 3;  // Triggers 3 renders

   // ✅ Single update
   Object.assign(this.state, { a: 1, b: 2, c: 3 });  // 1 render
   ```

4. **Lazy load large lists**
   ```javascript
   get visibleTodos() {
     return this.todos.slice(0, this.state.visibleCount);
   }
   ```

---

## 🐛 Debugging Components

### Enable logging in Loop/If

```javascript
// In LoopComponent.js
console.log('[Loop] Items:', items);
console.log('[Loop] Reconciling:', {
  oldKeys: Array.from(this.#itemsMap.keys()),
  newKeys: newItems.map(i => getKey(i))
});

// In IfComponent.js
console.log('[If] Condition:', condition, 'Show:', show);
```

### Inspect component state

```javascript
// In browser console
$0  // Selected element
$0.model  // Check model
$0.state  // Check reactive state
$0._vedaParentContext  // Check context
```

### Common issues

**Loop items not updating:**
```javascript
// ❌ Mutating array
this.todos.push(newTodo);  // Doesn't trigger reactivity

// ✅ New array
this.todos = [...this.todos, newTodo];  // Triggers reactivity
```

**If not showing:**
```javascript
// Check: Is condition reactive?
condition="{this.isVisible}"  // ✅ Reactive
condition="true"              // ❌ Static string

// Check: Parent context found?
console.log(this._vedaParentContext);  // Should not be null
```

**property not displaying:**
```javascript
// Check: Model loaded?
console.log(this.model);  // Should be Model instance

// Check: Property exists?
console.log(this.model['rdfs:label']);  // Should have value

// Check: Property name correct?
property="rdfs:label"  // ✅ Correct
property="rdfs-label"  // ❌ Wrong (dash vs colon)
```

---

## ✅ Best Practices Summary

1. **Always use `<template>` in Loop/If**
2. **Provide `item-key` for Loop**
3. **Use computed properties for complex expressions**
4. **Prefer model as single source of truth**
5. **Use effects for imperative DOM operations**
6. **Clean up in disconnectedCallback**
7. **Bind event handlers in constructor**
8. **Use semantic CSS classes over inline styles**
9. **Test both imperative and declarative approaches**
10. **Choose the right component for the job**

---

## 🎓 When to Use What

| Scenario | Recommended Approach |
|----------|---------------------|
| **Todo list with filtering** | Loop (shown in imperative version) |
| **Display user profile fields** | property components |
| **List of related documents** | rel component |
| **Shopping cart items** | Loop with reconciliation |
| **Form fields from model** | property with templates |
| **Comments thread** | Loop (for interactivity) |
| **Static data grid** | rel with property |
| **Real-time chat** | Loop (for fine control) |
| **Conditional sections** | If component |
| **Admin panel CRUD** | Declarative (property/rel) |

---

This document provides a complete reference for all Veda Framework UI components. Both TodoMVC implementations demonstrate these concepts in practice!

