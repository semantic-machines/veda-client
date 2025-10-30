# Veda Framework Components Cheatsheet

Quick reference for all UI components and their syntax.

---

## 🎨 Template Functions

### `html` - Safe template with auto-escaping
```javascript
import { html } from 'framework';

html`<div>${userInput}</div>`  // ✅ Safe - escapes HTML
```

### `raw` - Unescaped template
```javascript
import { raw } from 'framework';

raw`<div>${trustedHTML}</div>`  // ⚠️ Dangerous - NO escaping
```

---

## 🔄 Reactive Expressions

Use `{expression}` for reactive bindings:

```javascript
// Text content
html`<div>{this.title}</div>`

// Attributes
html`<input value="{this.text}" />`

// Boolean attributes
html`<input checked="{this.isChecked}" />`

// Event handlers
html`<button onclick="{handleClick}" />`
```

**Supported syntax** (ExpressionParser):
```javascript
{this.prop}              // ✅ Simple property
{this.obj.nested.prop}   // ✅ Nested properties
{this.items.0.title}     // ✅ Array index
{this.user?.name}        // ✅ Optional chaining

{this.a + this.b}        // ❌ Operators NOT supported
{this.count === 0}       // ❌ Comparisons NOT supported
{fn()}                   // ❌ Function calls NOT supported
```

**Solution for complex expressions**: Use computed properties!

```javascript
get isEmpty() {
  return this.count === 0;  // ✅ Complex logic in getter
}

html`<div>{this.isEmpty}</div>`  // ✅ Simple expression
```

---

## 📦 Component Base Class

```javascript
import { Component } from 'framework';

class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({ count: 0 });
  }

  // Computed
  get doubled() {
    return this.state.count * 2;
  }

  // Lifecycle
  async connectedCallback() {
    await super.connectedCallback();
    this.effect(() => console.log(this.state.count));
  }

  // Render
  render() {
    return html`<div>{this.state.count}</div>`;
  }
}
```

---

## 🔁 Loop Component

Render lists with reconciliation:

```javascript
import { Loop } from 'framework';

html`
  <ul>
    <${Loop} items="{this.todos}" item-key="id">
      <template>
        <li is="${TodoItem}"></li>
      </template>
    </${Loop}>
  </ul>
`
```

**Attributes:**
- `items`: Expression returning array
- `item-key`: Property for reconciliation (default: `id`)

**How it works:**
- Each template instance gets `model = item`
- Reconciliation reuses DOM elements
- Updates only when items array changes

---

## ❓ If Component

Conditional rendering:

```javascript
import { If } from 'framework';

html`
  <${If} condition="{this.isVisible}">
    <template>
      <div>Visible content</div>
    </template>
  </${If}>
`
```

**Attributes:**
- `condition`: Expression evaluated as boolean

**How it works:**
- Creates/removes content based on condition
- Content inside `<template>` is cloned when shown
- Leaves comment node when hidden

---

## 📄 property Component

Display single value from model:

```html
<!-- Simple -->
<span property="rdfs:label"></span>

<!-- With template -->
<div property="v-s:title">
  <template>
    <strong><slot></slot></strong>
  </template>
</div>

<!-- Array values -->
<ul property="v-s:tags">
  <template>
    <li><slot></slot></li>
  </template>
</ul>
```

**Attributes:**
- `property` or `rel`: Model property name

**How it works:**
- Reads `this.model[property]`
- If array, renders each value
- `<slot>` replaced with value
- Automatically reactive

---

## 🔗 rel Component

Display related models:

```html
<div rel="v-s:hasApplication">
  <template>
    <app-card></app-card>  <!-- model = each related model -->
  </template>
</div>
```

**Attributes:**
- `rel`: Model property containing array of models

**How it works:**
- Iterates over `this.model[rel]`
- Each template gets `model = relatedModel`
- Child components inherit model
- Automatically reactive

---

## 🎯 PropertyComponent

Like `property` but with language support:

```html
<span property="rdfs:label" lang="en"></span>
```

**Features:**
- Filters by language suffix: `value^^EN`, `value^^RU`
- Uses `document.documentElement.lang`
- Inherits all from `property`

---

## 🔄 Lifecycle Hooks

```javascript
class MyComponent extends Component(HTMLElement) {
  // 1. Creation
  constructor() {
    super();
    // Initialize state
  }

  // 2. Before mount
  async populate() {
    // Load model (if has 'about' attribute)
  }

  // 3. After populate
  added() {
    // Setup listeners, effects
  }

  // 4. Before render
  pre() {
    // Prepare data
  }

  // 5. Render
  render() {
    return html`...`;
  }

  // 6. After render (before DOM)
  post(fragment) {
    // Modify fragment
  }

  // 7. After complete render (including children)
  renderedCallback() {
    // All done
  }

  // 8. On disconnect
  removed() {
    // Cleanup
  }

  disconnectedCallback() {
    // Auto-cleanup effects
    super.disconnectedCallback?.();
  }
}
```

---

## ⚡ Reactivity API

### `reactive(obj)` - Make object reactive
```javascript
this.state = this.reactive({
  count: 0,
  items: []
});
```

### `effect(fn)` - Run on dependency change
```javascript
this.effect(() => {
  console.log('Count:', this.state.count);
  // Re-runs when count changes
});
```

### `watch(getter, callback)` - Watch specific value
```javascript
this.watch(
  () => this.state.items.length,
  (newLen, oldLen) => {
    console.log(`Length: ${oldLen} -> ${newLen}`);
  },
  { immediate: true }
);
```

### Computed properties - Use getters
```javascript
get doubled() {
  return this.state.count * 2;  // Auto-tracks dependencies
}
```

---

## 🎭 Event Handling

### In template
```javascript
html`
  <button onclick="{handleClick}">Click</button>
  <input onchange="{handleChange}" />
  <input onkeydown="{handleKeyDown}" />
`
```

### Handler signature
```javascript
handleClick(event, node) {
  // event: DOM Event
  // node: Element that triggered event
}
```

### Custom events
```javascript
// Emit
this.dispatchEvent(new CustomEvent('item-selected', {
  detail: { id: 123 },
  bubbles: true  // ← Important for parent to catch
}));

// Listen
this.addEventListener('item-selected', (event) => {
  console.log(event.detail.id);
});
```

---

## 📋 Common Patterns

### Parent → Child (Props)
```javascript
// Parent
html`<child-comp title="{this.title}"></child-comp>`

// Child
static get observedAttributes() {
  return ['title'];
}

attributeChangedCallback(name, oldVal, newVal) {
  this.update();
}
```

### Child → Parent (Events)
```javascript
// Child
this.dispatchEvent(new CustomEvent('change', {
  detail: { value: 123 },
  bubbles: true
}));

// Parent
html`<child-comp onchange="{handleChildChange}"></child-comp>`
```

### Model sharing
```javascript
// Automatic via 'about'
html`<child-comp about="${modelId}"></child-comp>`

// Manual
const child = this.querySelector('child-comp');
child.model = this.model;
```

---

## ✅ Best Practices

1. **Always wrap Loop/If content in `<template>`**
   ```javascript
   html`
     <${Loop} items="{this.items}" item-key="id">
       <template>  ← Required!
         <my-item></my-item>
       </template>
     </${Loop}>
   `
   ```

2. **Use computed for complex logic**
   ```javascript
   // ❌ Bad
   html`<div>{this.a > this.b ? this.a : this.b}</div>`

   // ✅ Good
   get max() { return Math.max(this.a, this.b); }
   html`<div>{this.max}</div>`
   ```

3. **Bind handlers in constructor**
   ```javascript
   constructor() {
     super();
     this.handleClick = this.handleClick.bind(this);
   }
   ```

4. **Clean up in disconnectedCallback**
   ```javascript
   disconnectedCallback() {
     // Custom cleanup
     super.disconnectedCallback?.();  // Auto-cleans effects
   }
   ```

5. **Use model as source of truth**
   ```javascript
   // ✅ Good
   get todos() {
     return this.model['v-s:hasTodo'] || [];
   }

   // ❌ Bad - duplication
   this.state.todos = [...this.model['v-s:hasTodo']];
   ```

---

## 🐛 Common Pitfalls

1. **Forgetting `<template>` in Loop/If**
   ```javascript
   // ❌ Wrong
   <${Loop} items="{items}">
     <my-item></my-item>
   </${Loop}>

   // ✅ Correct
   <${Loop} items="{items}">
     <template><my-item></my-item></template>
   </${Loop}>
   ```

2. **Complex expressions in templates**
   ```javascript
   // ❌ Parser doesn't support
   html`<div>{this.count === 0 ? 'none' : 'some'}</div>`

   // ✅ Use getter
   get text() { return this.count === 0 ? 'none' : 'some'; }
   html`<div>{this.text}</div>`
   ```

3. **Not calling super.connectedCallback()**
   ```javascript
   // ❌ Missing super
   async connectedCallback() {
     this.setup();
   }

   // ✅ With super
   async connectedCallback() {
     await super.connectedCallback();
     this.setup();
   }
   ```

4. **Missing key in Loop**
   ```javascript
   // ❌ No key - poor performance
   <${Loop} items="{items}">

   // ✅ With key - optimized
   <${Loop} items="{items}" item-key="id">
   ```

---

## 📚 Quick Links

- **TodoMVC Imperative**: [src/js/](src/js/)
- **TodoMVC Declarative**: [src-declarative/js/](src-declarative/js/)
- **Component Source**: [../src/components/Component.js](../src/components/Component.js)
- **Tests**: [../test/](../test/)

