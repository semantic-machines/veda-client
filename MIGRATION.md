# Migration Guide

Guide for upgrading between Veda Client Framework versions.

## Current Version: 2.0.0

---

## From 1.x to 2.0.0

### Breaking Changes

#### 1. Reactive System

**Before (1.x):**
```javascript
import Component from './src/components/Component.js';

class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    this.count = 0; // Plain property
  }

  increment() {
    this.count++;
    this.update(); // Manual update required
  }
}
```

**After (2.0):**
```javascript
import Component from './src/components/Component.js';

class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({ count: 0 }); // Reactive state
  }

  increment() {
    this.state.count++; // Automatic updates
  }
}
```

**Migration steps:**
1. Wrap state in `this.reactive()`
2. Remove manual `this.update()` calls
3. Update template expressions to use `this.state.prop`

#### 2. Effect System - Now Async

**Before (1.x):**
```javascript
effect(() => {
  console.log(state.count); // Ran synchronously
});
state.count = 5; // Effect ran immediately
```

**After (2.0):**
```javascript
effect(() => {
  console.log(state.count); // Runs async (microtask)
});
state.count = 5; // Effect queued
await flushEffects(); // For testing
```

**Migration steps:**
1. Tests: Add `await flushEffects()` after state changes
2. Remove race condition workarounds (now handled automatically)

#### 3. Loop Component Syntax

**Before (1.x):**
```javascript
// Required <template> wrapper
<veda-loop items="{this.items}">
  <template>
    <div>{this.model.title}</div>
  </template>
</veda-loop>
```

**After (2.0):**
```javascript
// <template> optional (backward compatible)
<${Loop} items="{this.items}" item-key="id">
  <div>{this.model.title}</div>
</${Loop}>
```

**Migration steps:**
1. Import Loop: `import { Loop } from './src/components/LoopComponent.js';`
2. Use component syntax: `<${Loop}>` instead of `<veda-loop>`
3. Add `item-key` attribute for better performance
4. (Optional) Remove `<template>` wrapper

#### 4. If Component Syntax

**Before (1.x):**
```javascript
<veda-if condition="{this.show}">
  <template>
    <div>Content</div>
  </template>
</veda-if>
```

**After (2.0):**
```javascript
import { If } from './src/components/IfComponent.js';

<${If} condition="{this.show}">
  <div>Content</div>
</${If}>
```

**Migration steps:**
1. Import If: `import { If } from './src/components/IfComponent.js';`
2. Use component syntax: `<${If}>`
3. (Optional) Remove `<template>` wrapper

#### 5. Expression Parser - Stricter

**Before (1.x):**
```javascript
// Some operators worked (undocumented)
<div>{this.count + 1}</div>
```

**After (2.0):**
```javascript
// Only property access supported
<div>{this.count}</div> // ✅
<div>{this.count + 1}</div> // ❌ Parser error

// Use computed properties
get incrementedCount() {
  return this.count + 1;
}
<div>{this.incrementedCount}</div> // ✅
```

**Migration steps:**
1. Replace complex expressions with computed properties (getters)
2. Remove operators, ternaries, function calls from templates

#### 6. Property Component - Declarative Syntax

**Before (1.x):**
```javascript
// Manual property binding
<span about="{this.model.id}" property="v-s:title"></span>
```

**After (2.0):**
```javascript
// Automatic model inheritance (preferred)
<span property="v-s:title"></span>

// Or explicit model via about
<span about="d:Person1" property="v-s:title"></span>
```

**Migration steps:**
1. Remove redundant `about` attributes (inherits from parent)
2. Property components now reactive by default
3. Language filtering automatic via `document.documentElement.lang`

**New features:**
```javascript
// Template support
<div property="v-s:email">
  <template>
    <a href="mailto:"><slot></slot></a>
  </template>
</div>

// Shadow DOM support
<span property="v-s:title" shadow></span>
```

#### 7. Relation Component - Template Simplification

**Before (1.x):**
```javascript
// Required <template> wrapper
<div rel="v-s:hasTodo">
  <template>
    <li>{this.model['v-s:title']}</li>
  </template>
</div>
```

**After (2.0):**
```javascript
// Template wrapper optional (backward compatible)
<div rel="v-s:hasTodo">
  <li>{this.model['v-s:title']}</li>
</div>

// Or use with custom components
<div rel="v-s:hasAuthor">
  <person-card></person-card>
</div>
```

**Migration steps:**
1. (Optional) Remove `<template>` wrappers
2. Relation components now reactive by default
3. Each child auto-receives related model via `model` prop

**When to use Relation vs Loop:**

```javascript
// ✅ Use Relation for RDF relations (auto-loads models)
<ul rel="v-s:hasTodo">
  <li>{this.model['v-s:title']}</li>
</ul>

// ✅ Use Loop for generic arrays (manual control)
<${Loop} items="{this.todos}" item-key="id">
  <todo-item></todo-item>
</${Loop}>
```

#### 6. Model Reactivity

**Before (1.x):**
```javascript
model.on('propertyModified', () => {
  this.update(); // Manual update
});
```

**After (2.0):**
```javascript
// Automatic updates if using this.reactive()
constructor() {
  super();
  this.state = this.reactive({ }); // Enables auto-updates
}

// Model changes automatically trigger updates
```

**Migration steps:**
1. Add `this.reactive()` in constructor
2. Remove model event listeners for updates
3. Effects cleanup handled automatically

### New Features in 2.0

#### Computed Values

```javascript
import { computed } from './src/Reactive.js';

const state = reactive({ count: 0 });
const doubled = computed(() => state.count * 2);

console.log(doubled.value); // Access via .value
```

#### Watch API

```javascript
this.watch(
  () => this.state.count,
  (newValue, oldValue) => {
    console.log(`Changed from ${oldValue} to ${newValue}`);
  },
  { immediate: true }
);
```

#### Batched Effects

Multiple state changes trigger only one update:

```javascript
state.count = 1;
state.name = 'Alice';
state.active = true;
// Single DOM update (batched via microtask)
```

#### Infinite Loop Detection

```javascript
effect(() => {
  state.count++; // Detected after 100 iterations
});
// Error: "Infinite loop detected"
```

### Deprecations

#### None in 2.0

All 1.x APIs still work but may emit console warnings.

### Removals

#### None in 2.0

Full backward compatibility maintained.

---

## Upgrade Checklist

### Preparation

- [ ] Read CHANGELOG.md for all changes
- [ ] Back up your codebase
- [ ] Review LIMITATIONS.md for new constraints
- [ ] Check TypeScript definitions (if using TS)

### Code Changes

- [ ] Wrap component state in `this.reactive()`
- [ ] Remove manual `this.update()` calls (if using reactive state)
- [ ] Update Loop/If imports and syntax
- [ ] Replace complex template expressions with computed properties
- [ ] Add `item-key` to Loop components
- [ ] (Optional) Remove `<template>` wrappers from Relation components
- [ ] Verify Property/Relation components inherit models correctly

### Testing

- [ ] Add `await flushEffects()` in tests after state changes
- [ ] Test reactive updates work automatically
- [ ] Test Loop reconciliation with keys
- [ ] Verify expression parser rejects invalid syntax

### Performance

- [ ] Add `item-key` to all Loop components (important!)
- [ ] Check large lists (>500 items) - may need optimization
- [ ] Profile effect execution (should be async now)

### Deployment

- [ ] Update bundle size expectations (48 KB browser)
- [ ] Test in all supported browsers
- [ ] Monitor error logs for deprecation warnings
- [ ] Update documentation

---

## Step-by-Step Migration Example

### Before (1.x)

```javascript
// OldTodoList.js
import Component from './src/components/Component.js';

class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.todos = [];
  }

  addTodo(text) {
    this.todos.push({ id: Date.now(), text, done: false });
    this.update(); // Manual
  }

  render() {
    return `
      <ul>
        ${this.todos.map(todo => `
          <li>${todo.text}</li>
        `).join('')}
      </ul>
    `;
  }
}
```

### After (2.0)

```javascript
// NewTodoList.js
import Component, { html } from './src/components/Component.js';
import { Loop } from './src/components/LoopComponent.js';

class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({ todos: [] }); // Reactive
  }

  addTodo(text) {
    this.state.todos = [
      ...this.state.todos,
      { id: Date.now(), text, done: false }
    ];
    // No manual update needed!
  }

  render() {
    return html`
      <ul>
        <${Loop} items="{this.state.todos}" item-key="id">
          <li>{this.model.text}</li>
        </${Loop}>
      </ul>
    `;
  }
}
```

### Key Changes

1. ✅ Added `this.reactive()` for state
2. ✅ Removed `this.update()` call
3. ✅ Used `html` template tag
4. ✅ Used Loop component with `item-key`
5. ✅ Template uses `{expression}` syntax

---

## Common Issues

### Issue: "Effects not running"

**Symptom:**
```javascript
state.count = 5;
// Effect doesn't run
```

**Solution:**
Effects are async. Wait for them:
```javascript
state.count = 5;
await flushEffects(); // In tests
```

### Issue: "Loop not updating"

**Symptom:**
```javascript
this.state.items.push(newItem);
// Loop doesn't update
```

**Solution:**
Loop needs array reference change:
```javascript
this.state.items = [...this.state.items, newItem];
```

### Issue: "Expression parser error"

**Symptom:**
```javascript
<div>{this.count + 1}</div>
// Error: Unexpected token
```

**Solution:**
Use computed property:
```javascript
get incrementedCount() {
  return this.count + 1;
}
<div>{this.incrementedCount}</div>
```

---

## Getting Help

- **Documentation:** [REACTIVITY.md](./REACTIVITY.md), [API.md](./API.md)
- **Examples:** `app-todo/` directory
- **Issues:** [GitHub Issues](https://github.com/semantic-machines/veda-client/issues)

---

## Future Migrations

### 2.x to 3.x (planned)

Potential breaking changes:
- LIS reconciliation in Loop (performance improvement)
- Expression parser may support operators
- Component lifecycle changes

Stay tuned to CHANGELOG.md for announcements.

---

**Last updated:** November 2024
**Version:** 2.0.0

