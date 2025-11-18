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
import { Component, html } from 'framework';

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
      <li is="${TodoItem}"></li>
    </${Loop}>
  </ul>
`
```

**Attributes:**
- `items`: Expression returning array
- `item-key`: Property for reconciliation (default: `id`)

**How it works:**
- Each child element gets `model = item`
- Reconciliation reuses DOM elements
- Updates only when items array changes

**Template wrapper is optional:**
```javascript
// ✅ Modern syntax (no template)
<${Loop} items="{this.todos}" item-key="id">
  <li>{this.model.title}</li>
</${Loop}>

// ✅ Also works (backward compatibility)
<${Loop} items="{this.todos}" item-key="id">
  <template>
    <li>{this.model.title}</li>
  </template>
</${Loop}>
```

---

## ❓ If Component

Conditional rendering:

```javascript
import { If } from 'framework';

html`
  <${If} condition="{this.isVisible}">
    <div>Visible content</div>
  </${If}>
`
```

**Attributes:**
- `condition`: Expression evaluated as boolean

**How it works:**
- Creates/removes content based on condition
- Child elements are cloned when shown
- Leaves comment node when hidden

**Template wrapper is optional:**
```javascript
// ✅ Modern syntax (no template)
<${If} condition="{this.show}">
  <div>Content</div>
</${If}>

// ✅ Also works (backward compatibility)
<${If} condition="{this.show}">
  <template>
    <div>Content</div>
  </template>
</${If}>
```

---

## 📄 property Attribute

Display model property values (declarative data binding):

```html
<!-- Simple -->
<span property="rdfs:label"></span>

<!-- With custom formatting -->
<div property="v-s:title">
  <strong><slot></slot></strong>
</div>

<!-- Array values -->
<ul property="v-s:tags">
  <li><slot></slot></li>
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

## 🔗 rel Attribute

Display related models (declarative relations):

```html
<!-- Simple -->
<div rel="v-s:hasApplication">
  <app-card></app-card>
</div>

<!-- Nested -->
<div rel="v-s:hasApplication">
  <h3 property="rdfs:label"></h3>
  <ul rel="v-s:hasPermission">
    <li property="rdfs:label"></li>
  </ul>
</div>
```

**Attributes:**
- `rel`: Model property containing array of models

**How it works:**
- Iterates over `this.model[rel]`
- Each child element gets `model = relatedModel`
- Automatically reactive

---

## 🎯 Combining Approaches

You can use **all three approaches** together:

### 1. Reactive Components (with Loop/If)
```javascript
import { Component, html, Loop } from 'framework';

class TodoApp extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({ todos: [], filter: 'all' });
  }

  get filteredTodos() {
    return this.state.todos.filter(t =>
      this.state.filter === 'all' || t.status === this.state.filter
    );
  }

  render() {
    return html`
      <ul>
        <${Loop} items="{this.filteredTodos}" item-key="id">
          <li>{this.model.title}</li>
        </${Loop}>
      </ul>
    `;
  }
}
```

### 2. Declarative Components (with property/rel)
```html
<!-- Pure HTML, no JavaScript needed -->
<div about="v-s:currentUser">
  <h1 property="rdfs:label"></h1>
  <p property="v-s:email"></p>

  <ul rel="v-s:hasApplication">
    <li property="rdfs:label"></li>
  </ul>
</div>
```

### 3. Hybrid (best of both)
```javascript
class UserProfile extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({ editing: false });
  }

  render() {
    return html`
      <div>
        <!-- Declarative binding -->
        <h1 property="rdfs:label"></h1>

        <!-- Reactive state -->
        <${If} condition="{this.state.editing}">
          <input property="v-s:firstName" />
        </${If}>

        <!-- Declarative relations -->
        <ul rel="v-s:hasRole">
          <li property="rdfs:label"></li>
        </ul>
      </div>
    `;
  }
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

### When to use what?

**Use Loop/If (reactive):**
- ✅ Dynamic lists with filtering/sorting
- ✅ Computed state
- ✅ Complex conditional logic
- ✅ Interactive UIs

**Use property/rel (declarative):**
- ✅ Simple data display
- ✅ Static semantic data
- ✅ Rapid prototyping
- ✅ No-code components

**Use both together:**
- ✅ Complex apps
- ✅ Best of both worlds

---

## ✅ Best Practices

1. **Loop/If content no longer needs `<template>` wrapper**
   ```javascript
   // ✅ Clean syntax
   html`
     <${Loop} items="{this.items}" item-key="id">
       <my-item></my-item>
     </${Loop}>
   `

   // ✅ Also works (backward compatibility)
   html`
     <${Loop} items="{this.items}" item-key="id">
       <template>
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

3. **Use this.reactive() in components**
   ```javascript
   constructor() {
     super();
     this.state = this.reactive({ count: 0 });  // ✅
   }
   ```

4. **Clean up in disconnectedCallback**
   ```javascript
   disconnectedCallback() {
     // Effects cleaned automatically
     super.disconnectedCallback?.();
   }
   ```

5. **Use model as source of truth**
   ```javascript
   // ✅ Good
   get todos() {
     return this.model['v-s:hasTodo'] || [];
   }
   ```

---

## 🐛 Common Pitfalls

1. **Complex expressions in templates**
   ```javascript
   // ❌ Parser doesn't support
   html`<div>{this.count === 0 ? 'none' : 'some'}</div>`

   // ✅ Use getter
   get text() { return this.count === 0 ? 'none' : 'some'; }
   html`<div>{this.text}</div>`
   ```

2. **Missing key in Loop**
   ```javascript
   // ❌ No key - poor performance
   <${Loop} items="{items}">

   // ✅ With key - optimized
   <${Loop} items="{items}" item-key="id">
   ```

3. **Using global reactive() instead of this.reactive()**
   ```javascript
   // ❌ Missing internal flag
   import { reactive } from 'framework';
   this.state = reactive({ count: 0 });

   // ✅ Correct - sets internal flag
   this.state = this.reactive({ count: 0 });
   ```

---

## 📚 Quick Links

- **Main Documentation**: [DOCUMENTATION.md](../DOCUMENTATION.md)
- **Reactivity Guide**: [REACTIVITY.md](../REACTIVITY.md)
- **Component Source**: [../src/components/Component.js](../src/components/Component.js)
- **Tests**: [../test/](../test/)
