# Veda Components Guide

Complete guide for building components with the Veda framework.

## Table of Contents

1. [Introduction](#introduction)
2. [Creating Components](#creating-components)
3. [Working with Models](#working-with-models)
4. [Templates and Rendering](#templates-and-rendering)
5. [Expression Syntax](#expression-syntax)
6. [Event Handlers](#event-handlers)
7. [Lifecycle](#lifecycle)
8. [Special Attributes](#special-attributes)
9. [Nested Components](#nested-components)
10. [Best Practices](#best-practices)

---

## Introduction

Veda components are based on Web Components with reactive data binding to RDF models.

**Key features:**
- Reactive templates with `{{ }}` syntax
- Automatic model binding
- Safe expression parser (CSP-compatible)
- Event delegation up component tree
- Semantic (RDF) data binding

---

## Creating Components

### Basic Component

```javascript
import Component, { html } from 'veda-client/components/Component.js';

class MyComponent extends Component(HTMLElement) {
  render() {
    return html`
      <h1>Hello, {{this.model.rdfs:label}}</h1>
      <p>ID: {{this.model.id}}</p>
    `;
  }
}

// Register component
customElements.define('my-component', MyComponent);
```

### Using the Component

```html
<!-- In HTML -->
<my-component about="test:123"></my-component>

<!-- In another component's template -->
<${MyComponent} about="{{this.model.id}}"></${MyComponent}>
```

---

## Working with Models

### Model Binding

Components automatically create and bind to a Model instance via the `about` attribute:

```javascript
class UserCard extends Component(HTMLElement) {
  render() {
    // this.model is automatically available
    return html`
      <div>
        <h2>{{this.model.rdfs:label}}</h2>
        <p>Email: {{this.model.v-s:email}}</p>
      </div>
    `;
  }
}
```

### Custom Model Class

```javascript
import Model from 'veda-client/Model.js';

class User extends Model {
  get fullName() {
    return `${this['v-s:firstName']} ${this['v-s:lastName']}`;
  }
}

class UserCard extends Component(HTMLElement, User) {
  render() {
    return html`
      <h2>{{this.model.fullName}}</h2>
    `;
  }
}
```

### Model Operations

```javascript
class Editor extends Component(HTMLElement) {
  addLabel() {
    this.model.addValue('rdfs:label', 'New Label');
    this.update();  // Re-render
  }

  removeLabel() {
    const label = this.model['rdfs:label'][0];
    this.model.removeValue('rdfs:label', label);
    this.update();
  }

  async save() {
    await this.model.save();
  }

  async remove() {
    await this.model.remove();
  }
}
```

---

## Templates and Rendering

### Template Syntax

Use `html` tagged template for rendering:

```javascript
import Component, { html } from 'veda-client/components/Component.js';

render() {
  return html`
    <div class="card">
      <h1>{{this.model.rdfs:label}}</h1>
      <p>{{this.model.rdfs:comment}}</p>
    </div>
  `;
}
```

### Conditional Rendering

Use JavaScript expressions in `${ }` (compile-time):

```javascript
render() {
  return html`
    ${this.model.isActive
      ? html`<span class="active">Active</span>`
      : html`<span class="inactive">Inactive</span>`
    }
  `;
}
```

### Lists

```javascript
render() {
  const items = this.model['v-s:hasItem'] || [];

  return html`
    <ul>
      ${items.map(item => html`
        <li>
          <${ItemComponent} about="{{item.id}}"></${ItemComponent}>
        </li>
      `)}
    </ul>
  `;
}
```

### Raw HTML

Use `safe()` function for trusted HTML:

```javascript
import { html, safe } from 'veda-client/components/Component.js';

render() {
  const trustedHtml = '<strong>Bold text</strong>';

  return html`
    <div>
      ${safe(trustedHtml)}
    </div>
  `;
}
```

---

## Expression Syntax

### Property Access (Dot Notation)

Use `{{ }}` for runtime evaluation in templates:

```html
<!-- Simple properties -->
{{this.model.id}}
{{this.model.name}}

<!-- RDF properties (no quotes needed!) -->
{{this.model.rdfs:label}}
{{this.model.rdf:type}}
{{this.model.v-s:creator}}

<!-- Array indexing with dot -->
{{this.model.rdfs:label.0}}
{{this.model.items.0.name}}

<!-- Nested properties -->
{{this.model.author.name}}
{{this.model.v-s:hasApplication.0.id}}

<!-- Optional chaining -->
{{this.model.author?.name}}
{{this.model.items?.0?.id}}
{{this.model.rel?.nested?.value}}
```

### Getters for Complex Logic

```javascript
class MyComponent extends Component(HTMLElement) {
  // Getter for computed value
  get displayName() {
    return this.model['rdfs:label']?.[0] || 'Unnamed';
  }

  // Getter for conditions
  get canSave() {
    return this.model.isValid && this.model.hasChanges;
  }

  // Getter with complex logic
  get status() {
    if (this.model.isActive && this.model.count > 0) {
      return 'active';
    } else if (this.model.count === 0) {
      return 'empty';
    } else {
      return 'inactive';
    }
  }

  render() {
    return html`
      <h1>{{this.displayName}}</h1>
      <p class="status-{{this.status}}">Status</p>
      <button disabled="${!this.canSave}">Save</button>
    `;
  }
}
```

### Interpolation Types

**`{{ }}` - Runtime (in child context):**
```html
<div rel="items">
  <span about="{{this.model.id}}">
    {{this.model.rdfs:label}}  <!-- Evaluated for each item -->
  </span>
</div>
```

**`${ }` - Compile-time (in parent context):**
```javascript
render() {
  return html`
    <p>Count: ${this.model.items.length}</p>  <!-- Evaluated once -->
    ${this.showDetails ? html`<details>...</details>` : ''}
  `;
}
```

### What's NOT Supported in {{ }}

Expressions don't support operators or function calls:

```html
<!-- ✗ NOT supported - use getters -->
{{this.count + 1}}
{{this.price * 1.2}}
{{this.isActive ? 'Yes' : 'No'}}
{{this.method()}}

<!-- ✓ Use getters instead -->
{{this.totalCount}}
{{this.priceWithTax}}
{{this.activeStatus}}
```

---

## Event Handlers

### Event Syntax

Use `onclick="{{expression}}"` with `{{ }}`:

```html
<!-- Method in current component -->
<button onclick="{{handleClick}}">Click</button>

<!-- Explicit this reference -->
<button onclick="{{this.handleClick}}">Click</button>

<!-- Model methods (context preserved automatically) -->
<button onclick="{{this.model.save}}">Save</button>
<button onclick="{{this.model.remove}}">Delete</button>
```

### Method Signature

All event handlers receive `(event, node)`:

```javascript
class MyComponent extends Component(HTMLElement) {
  handleClick(event, node) {
    console.log('Event:', event);
    console.log('Element:', node);
    console.log('Data:', node.dataset.id);
  }

  render() {
    return html`
      <button onclick="{{handleClick}}" data-id="123">
        Click
      </button>
    `;
  }
}
```

### Passing Data

Use `data-*` attributes:

```javascript
handleAction(event, node) {
  const action = node.dataset.action;
  const value = node.dataset.value;

  if (action === 'add') {
    this.model.addValue('rdfs:label', value);
  } else if (action === 'remove') {
    this.model.removeValue('rdfs:label', value);
  }

  this.update();
}

render() {
  return html`
    <button
      onclick="{{handleAction}}"
      data-action="add"
      data-value="New Label"
    >Add</button>

    <button
      onclick="{{handleAction}}"
      data-action="remove"
      data-value="{{this.model.rdfs:label.0}}"
    >Remove</button>
  `;
}
```

### Model Methods with Parameters

Wrap in component methods:

```javascript
class Editor extends Component(HTMLElement) {
  addLabel(event, node) {
    this.model.addValue('rdfs:label', 'New Label');
    this.update();
  }

  removeLabel(event, node) {
    const value = this.model['rdfs:label'][0];
    this.model.removeValue('rdfs:label', value);
    this.update();
  }

  render() {
    return html`
      <button onclick="{{addLabel}}">Add</button>
      <button onclick="{{removeLabel}}">Remove</button>
      <button onclick="{{this.model.save}}">Save</button>
    `;
  }
}
```

### Event Delegation

Methods are automatically searched up the component tree:

```javascript
class ParentComponent extends Component(HTMLElement) {
  deleteItem(event, node) {
    const id = node.dataset.id;
    console.log('Delete:', id);
  }

  render() {
    return html`
      <div rel="items">
        <span about="{{this.model.id}}">
          <!-- deleteItem found in ParentComponent -->
          <button onclick="{{deleteItem}}" data-id="{{this.model.id}}">
            Delete
          </button>
        </span>
      </div>
    `;
  }
}
```

### Supported Events

All standard DOM events:
- `onclick`, `ondblclick`, `oncontextmenu`
- `onchange`, `oninput`, `onsubmit`
- `onfocus`, `onblur`
- `onmouseenter`, `onmouseleave`, `onmouseover`, `onmouseout`
- `onkeydown`, `onkeyup`, `onkeypress`
- etc.

---

## Lifecycle

### Lifecycle Methods

```javascript
class MyComponent extends Component(HTMLElement) {
  // Called when component is created
  constructor() {
    super();
    console.log('Component created');
  }

  // Called when component is added to DOM
  async connectedCallback() {
    await super.connectedCallback();
    console.log('Component connected');

    // this.model is available here
    await this.model.load();  // Load from backend
    this.model.subscribe();   // Subscribe to changes
  }

  // Called when component is removed from DOM
  disconnectedCallback() {
    super.disconnectedCallback();
    console.log('Component disconnected');

    // Cleanup
    this.model?.unsubscribe?.();
  }

  // Re-render component
  update() {
    // Called manually to re-render
    super.update();
  }
}
```

### Manual Updates

Call `update()` when you change model data:

```javascript
handleAdd() {
  this.model.addValue('rdfs:label', 'New Label');
  this.update();  // Re-render
}
```

**Note:** Model operations that trigger backend calls (save, remove) don't require manual `update()`.

---

## Special Attributes

### `about` - Model Binding

Binds element to a model by ID. **Creates a new component instance** with its own model.

```html
<!-- Static ID -->
<my-component about="test:123"></my-component>

<!-- Dynamic ID from parent model -->
<div about="{{this.model.creator.id}}">
  <!-- This div becomes a component with creator model -->
  <span property="rdfs:label"></span>
</div>
```

**Auto-updates:** Element re-renders when its model changes.

### `property` - Property Display

Displays model property value. **Automatically updates** when property changes.

#### Single Value

```html
<!-- Display first value -->
<span property="rdfs:label"></span>
<p property="rdfs:comment"></p>
<a property="v-s:url"></a>
```

#### Multiple Values

```html
<!-- List all values -->
<ul property="rdfs:label">
  <li></li>  <!-- Template for each value -->
</ul>

<div property="v-s:hasTag">
  <span class="tag"></span>  <!-- Rendered for each tag -->
</div>
```

#### With Custom Element

```html
<!-- Use custom component for each value -->
<div property="rdfs:label">
  <${LabelComponent}></${LabelComponent}>
</div>
```

#### Nested Property Access

```html
<!-- Access nested model properties -->
<div about="{{this.model.author.id}}">
  <span property="rdfs:label"></span>  <!-- Author's label -->
  <span property="v-s:email"></span>   <!-- Author's email -->
</div>
```

**Auto-updates:** Automatically re-renders when property value changes (add, remove, update).

### `rel` - Relation Iteration

Iterates over **related models** (not just values). Each related model gets its own component instance.

#### Basic Usage

```html
<div rel="v-s:hasItem">
  <!-- Rendered for each related item model -->
  <p property="rdfs:label"></p>
  <p property="rdfs:comment"></p>
</div>
```

#### With Custom Components

```html
<div rel="v-s:hasItem">
  <${ItemComponent} about="{{this.model.id}}"></${ItemComponent}>
</div>

<!-- Or using 'is' attribute -->
<div rel="v-s:hasItem">
  <div is="${ItemComponent}">
    <span property="rdfs:label"></span>
  </div>
</div>
```

#### Nested Relations

```html
<div rel="v-s:hasApplication">
  <h3>{{this.model.rdfs:label}}</h3>

  <!-- Nested relation inside parent relation -->
  <ul rel="v-s:hasPermission">
    <li property="rdfs:label"></li>
  </ul>
</div>
```

#### Relation with Shadow DOM

```html
<!-- Each item isolated in shadow DOM -->
<div rel="v-s:hasItem" shadow>
  <style>
    .item { color: blue; }  /* Scoped styles */
  </style>
  <div class="item">
    <span property="rdfs:label"></span>
  </div>
</div>
```

**Auto-updates:** Automatically updates when relations change (add, remove related models).

### Combining Attributes

#### `about` + `property`

```html
<!-- Display property of specific model -->
<div about="v-s:currentUser">
  <span property="rdfs:label"></span>
  <span property="v-s:email"></span>
</div>
```

#### `about` + `rel`

```html
<!-- Relations of specific model -->
<div about="{{this.model.creator.id}}">
  <h2>Creator's Applications</h2>
  <ul rel="v-s:hasApplication">
    <li property="rdfs:label"></li>
  </ul>
</div>
```

#### `rel` + `property` + nested `about`

```html
<div rel="v-s:hasApplication">
  <!-- For each application -->
  <h3 property="rdfs:label"></h3>

  <!-- Show application creator -->
  <div about="{{this.model.v-s:creator.id}}">
    <span property="rdfs:label"></span>
  </div>

  <!-- Show application permissions -->
  <ul rel="v-s:hasPermission">
    <li property="rdfs:label"></li>
  </ul>
</div>
```

### `is` - Component Type

Specifies custom element class for rendering:

```html
<!-- Use custom component -->
<p about="{{this.model.id}}" is="${CustomComponent}">
  Content
</p>

<!-- In relations -->
<div rel="v-s:hasItem" is="${ItemComponent}">
  <!-- ItemComponent template -->
</div>
```

### `shadow` - Shadow DOM

Renders component in shadow DOM for style isolation:

```html
<div rel="items" shadow>
  <style>
    /* Scoped to this component only */
    .item { color: red; }
  </style>
  <div class="item">...</div>
</div>
```

---

## Declarative Components

One of the most powerful features - build **complex components without JavaScript code**.

### Example: User Profile (No JS)

```html
<div about="v-s:currentUser">
  <!-- User info -->
  <h1 property="rdfs:label"></h1>
  <p property="v-s:email"></p>

  <!-- User's applications -->
  <h2>Applications</h2>
  <ul rel="v-s:hasApplication">
    <li>
      <a property="rdfs:label"></a>
      <span property="rdfs:comment"></span>
    </li>
  </ul>

  <!-- User's roles -->
  <h2>Roles</h2>
  <div rel="v-s:hasRole">
    <span property="rdfs:label" class="badge"></span>
  </div>
</div>
```

**Result:** Fully functional component with auto-updates, no JavaScript required!

### Example: Nested Data Structure

```html
<div about="app:project-123">
  <h1 property="rdfs:label"></h1>

  <!-- Project members -->
  <div rel="v-s:hasMember">
    <div class="member">
      <h3 property="rdfs:label"></h3>
      <p property="v-s:email"></p>

      <!-- Member's roles in this project -->
      <ul rel="v-s:hasRole">
        <li property="rdfs:label"></li>
      </ul>
    </div>
  </div>

  <!-- Project tasks -->
  <div rel="v-s:hasTask">
    <div class="task">
      <h4 property="rdfs:label"></h4>
      <p property="rdfs:comment"></p>

      <!-- Task assignee -->
      <div about="{{this.model.v-s:assignedTo.id}}">
        <span>Assigned to: </span>
        <span property="rdfs:label"></span>
      </div>
    </div>
  </div>
</div>
```

### Auto-Update Examples

#### Property Changes

```javascript
// In console or code:
const user = new Model('v-s:currentUser');
await user.load();

user.addValue('rdfs:label', 'New Name');
await user.save();

// UI automatically updates! No manual update() call needed.
```

#### Relation Changes

```javascript
const project = new Model('app:project-123');
await project.load();

const newMember = new Model('user:456');
project.addValue('v-s:hasMember', newMember);
await project.save();

// New member automatically appears in the list!
```

#### Removing Relations

```javascript
const project = new Model('app:project-123');
await project.load();

const member = project['v-s:hasMember'][0];
project.removeValue('v-s:hasMember', member);
await project.save();

// Member automatically removed from UI!
```

### When to Use Declarative vs Programmatic

**Use declarative (`property`, `rel`):**
- ✅ Simple data display
- ✅ Lists and relations
- ✅ Nested structures
- ✅ Standard CRUD interfaces
- ✅ Rapid prototyping

**Use programmatic (JavaScript):**
- ✅ Complex logic and conditions
- ✅ Custom event handling
- ✅ Computed values
- ✅ Custom rendering
- ✅ API integrations

**Best approach:** Combine both!

```javascript
class UserProfile extends Component(HTMLElement) {
  get statusClass() {
    return this.model.isActive ? 'active' : 'inactive';
  }

  handleToggleStatus() {
    this.model.isActive = !this.model.isActive;
    this.model.save();
  }

  render() {
    return html`
      <div class="profile ${this.statusClass}">
        <!-- Declarative data binding -->
        <h1 property="rdfs:label"></h1>
        <p property="v-s:email"></p>

        <!-- Programmatic control -->
        <button onclick="{{handleToggleStatus}}">
          Toggle Status
        </button>

        <!-- Declarative relations -->
        <ul rel="v-s:hasApplication">
          <li property="rdfs:label"></li>
        </ul>
      </div>
    `;
  }
}
```

---

## Nested Components

### Creating Child Components

```javascript
class ItemComponent extends Component(HTMLElement) {
  render() {
    return html`
      <div class="item">
        <h3>{{this.model.rdfs:label}}</h3>
        <button onclick="{{this.model.remove}}">Delete</button>
      </div>
    `;
  }
}

class ListComponent extends Component(HTMLElement) {
  render() {
    return html`
      <div rel="v-s:hasItem">
        <${ItemComponent} about="{{this.model.id}}"></${ItemComponent}>
      </div>
    `;
  }
}
```

### Passing Data to Children

```javascript
render() {
  return html`
    <${ChildComponent}
      about="{{this.model.id}}"
      data-parent-id="{{this.parentId}}"
    ></${ChildComponent}>
  `;
}
```

### Component Communication

**Parent → Child:** Via model or data attributes

```javascript
// Parent
render() {
  return html`
    <${Child} about="{{this.model.child.id}}"></${Child}>
  `;
}
```

**Child → Parent:** Via event delegation

```javascript
// Parent
class ParentComponent extends Component(HTMLElement) {
  handleChildAction(event, node) {
    console.log('Child action:', node.dataset.value);
  }
}

// Child
class ChildComponent extends Component(HTMLElement) {
  render() {
    return html`
      <button
        onclick="{{handleChildAction}}"
        data-value="{{this.model.id}}"
      >Action</button>
    `;
  }
}
```

---

## Best Practices

### 1. Use Getters for Computed Values

```javascript
// ✓ Good
get displayName() {
  return this.model['rdfs:label']?.[0] || 'Unnamed';
}

render() {
  return html`<h1>{{this.displayName}}</h1>`;
}

// ✗ Avoid
render() {
  const name = this.model['rdfs:label']?.[0] || 'Unnamed';
  return html`<h1>${name}</h1>`;  // Won't update on model change
}
```

### 2. Separate Logic from Templates

```javascript
// ✓ Good
class MyComponent extends Component(HTMLElement) {
  get items() {
    return this.model['v-s:hasItem']?.filter(item => item.isActive) || [];
  }

  render() {
    return html`
      ${this.items.map(item => html`<div>...</div>`)}
    `;
  }
}
```

### 3. Use Wrapper Methods for Complex Events

```javascript
// ✓ Good
handleSave(event, node) {
  if (this.validate()) {
    this.model.save().then(() => {
      this.showMessage('Saved!');
    });
  }
}

// ✗ Avoid inline logic in templates
```

### 4. Clean Up in disconnectedCallback

```javascript
disconnectedCallback() {
  super.disconnectedCallback();

  // Unsubscribe from model changes
  this.model?.unsubscribe?.();

  // Clear timers
  clearInterval(this.intervalId);

  // Remove event listeners
  this.cleanup();
}
```

### 5. Use Shadow DOM for Style Isolation

```html
<div rel="items" shadow>
  <style>
    /* Scoped styles */
    .item { color: red; }
  </style>
  <div class="item">...</div>
</div>
```

---

## Complete Example

```javascript
import Component, { html } from 'veda-client/components/Component.js';
import Model from 'veda-client/Model.js';

class User extends Model {
  get fullName() {
    return `${this['v-s:firstName']} ${this['v-s:lastName']}`;
  }

  get isAdmin() {
    return this['v-s:hasRole']?.some(role => role.id === 'role:Admin');
  }
}

class UserCard extends Component(HTMLElement, User) {
  constructor() {
    super();
    this.editing = false;
  }

  get statusClass() {
    return this.model.isActive ? 'active' : 'inactive';
  }

  toggleEdit() {
    this.editing = !this.editing;
    this.update();
  }

  async handleSave() {
    await this.model.save();
    this.editing = false;
    this.update();
  }

  handleDelete() {
    if (confirm('Delete user?')) {
      this.model.remove();
    }
  }

  render() {
    return html`
      <div class="user-card ${this.statusClass}">
        <h2>{{this.model.fullName}}</h2>

        ${this.editing
          ? html`
            <input
              type="text"
              value="{{this.model.v-s:firstName}}"
              oninput="{{handleFirstNameChange}}"
            />
            <button onclick="{{handleSave}}">Save</button>
          `
          : html`
            <p>Email: {{this.model.v-s:email}}</p>
            <button onclick="{{toggleEdit}}">Edit</button>
          `
        }

        ${this.model.isAdmin
          ? html`<span class="badge">Admin</span>`
          : ''
        }

        <button onclick="{{handleDelete}}" class="danger">
          Delete
        </button>
      </div>
    `;
  }
}

customElements.define('user-card', UserCard);
```

---

## Security

- **CSP compatible** - No `unsafe-eval` needed
- **XSS protection** - No code execution in templates
- **Safe parser** - Only property access, no operators
- **Minimal attack surface** - Ultra-simple dot notation parser (~74 lines)

---

## Performance Tips

1. **Minimize re-renders** - Only call `update()` when necessary
2. **Use getters sparingly** - They're called on every render
3. **Cache expensive computations** - Store in properties, not getters
4. **Avoid deep nesting** - Keep component tree shallow
5. **Use shadow DOM** - For style isolation without global CSS

---

For more information, see the source code and tests in the repository.
