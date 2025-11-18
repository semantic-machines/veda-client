# API Reference

Complete API documentation for Veda Client Framework.

## Table of Contents

- [Component](#component)
- [Reactivity](#reactivity)
- [Built-in Components](#built-in-components)
  - [Loop](#loop)
  - [If](#if)
  - [Property](#property)
  - [Relation](#relation)
- [Model](#model)
- [Backend](#backend)
- [Router](#router)
- [Value](#value)
- [WeakCache](#weakcache)
- [BackendError](#backenderror)
- [TypeScript](#typescript)

---

## Component

Base class for creating reactive Web Components.

### Usage

```javascript
import Component, { html } from './src/components/Component.js';

class MyComponent extends Component(HTMLElement) {
  static tag = 'my-component';

  constructor() {
    super();
    this.state = this.reactive({ count: 0 });
  }

  render() {
    return html`<div>{this.state.count}</div>`;
  }
}

customElements.define(MyComponent.tag, MyComponent);
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `model` | `Model` | Associated semantic data model |
| `template` | `string` | Rendered HTML template |
| `rendered` | `Promise<void>` | Resolves when component is rendered |

### Lifecycle Methods

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    // Initialize state
  }

  async added() {
    // Called before first render
  }

  async pre() {
    // Called before each render
  }

  render() {
    // Return HTML template
    return html`<div>Content</div>`;
  }

  async post() {
    // Called after each render
  }

  async removed() {
    // Called after disconnection
  }

  async connectedCallback() {
    // Component added to DOM
    await super.connectedCallback();
  }

  disconnectedCallback() {
    // Component removed from DOM
    super.disconnectedCallback();
  }

  renderedCallback() {
    // Called after rendering completes
  }
}
```

### Reactive Methods

#### `reactive<T>(obj: T): T`

Creates reactive state for the component.

```javascript
constructor() {
  super();
  this.state = this.reactive({
    count: 0,
    items: []
  });
}
```

#### `effect(fn: () => void): () => void`

Creates effect with automatic cleanup.

```javascript
async connectedCallback() {
  await super.connectedCallback();

  this.effect(() => {
    console.log('Count:', this.state.count);
  });
}
```

#### `watch<T>(getter, callback, options?): () => void`

Watches reactive value changes and runs callback when value changes.

**Parameters:**
- `getter: () => T` - Function that returns the value to watch
- `callback: (newValue: T, oldValue: T | undefined) => void` - Called when value changes
- `options?: { immediate?: boolean }` - Optional configuration
  - `immediate: boolean` - If true, runs callback immediately with current value (default: false)

**Returns:** Cleanup function to stop watching

**Important:** Uses strict equality (===) for comparison. Array/object mutations won't trigger unless reference changes.

**Examples:**

```javascript
// Basic usage
this.watch(
  () => this.state.count,
  (newValue, oldValue) => {
    console.log(`Count changed from ${oldValue} to ${newValue}`);
  }
);

// With immediate option
this.watch(
  () => this.state.editing,
  (editing) => {
    this.classList.toggle('editing', editing);
  },
  { immediate: true }
);

// Watching array length (not array itself)
this.watch(
  () => this.state.items.length,
  (length) => console.log('Items count:', length)
);

// Manual cleanup
const stopWatching = this.watch(
  () => this.state.active,
  (active) => console.log('Active:', active)
);

// Later...
stopWatching(); // Stop watching
```

**Notes:**
- Cleanup is automatic on component disconnect
- Uses reference equality - see Limitations for details
- Returns cleanup function for manual control

**Common pitfalls:**

```javascript
// ❌ Won't trigger - same array reference
this.watch(() => state.items, callback);
state.items.push(4);  // No trigger!

// ✅ Triggers - new array reference
state.items = [...state.items, 4];

// ✅ Alternative - watch array length
this.watch(() => state.items.length, callback);
```

### Other Methods

#### `update(): Promise<void>`

Manually trigger re-render.

```javascript
async handleChange() {
  // Modify state
  await this.update();
}
```

#### `populate(): Promise<void>`

Populate component from model (internal use).

---

## Reactivity

Fine-grained reactivity system with automatic dependency tracking.

### `reactive<T>(target: T, options?): T`

Creates reactive proxy.

```javascript
import { reactive } from './src/Reactive.js';

const state = reactive({
  count: 0,
  user: { name: 'Alice' }
});

state.count++; // Triggers effects
```

**Options:**
```typescript
interface ReactiveOptions {
  onSet?: (key: string, value: any, oldValue: any) => void;
  onDelete?: (key: string) => void;
}
```

**Features:**
- Deep reactivity (nested objects automatically wrapped)
- Array mutation tracking (push, pop, shift, unshift, splice, sort, reverse)
- Circular reference handling
- Prototype pollution prevention

**Limitations:**
- Array index assignment not reactive: `arr[0] = x` (use `arr.splice(0, 1, x)`)
- New properties need explicit wrapping
- Date, RegExp, Promise not wrapped

### `computed<T>(getter: () => T)`

Creates computed value.

```javascript
import { computed } from './src/Reactive.js';

const state = reactive({ count: 0 });
const doubled = computed(() => state.count * 2);

console.log(doubled.value); // 0
state.count = 5;
console.log(doubled.value); // 10
```

**Note:** Access via `.value` property.

### `effect(fn: () => void, options?): () => void`

Creates auto-tracking effect.

```javascript
import { effect } from './src/Effect.js';

const cleanup = effect(() => {
  console.log('Count:', state.count);
});

state.count++; // Logs: "Count: 1"

cleanup(); // Stop effect
```

**Options:**
```typescript
interface EffectOptions {
  lazy?: boolean;           // Don't run immediately (default: false)
  scheduler?: (fn) => void; // Custom scheduler function
  computed?: boolean;       // Mark as computed effect (runs first)
}
```

**Features:**
- Automatic dependency tracking
- Batched async execution (via microtask)
- Infinite loop detection (max 100 triggers)
- Automatic cleanup

**Scheduler Example:**

```javascript
import { effect } from './src/Effect.js';

// Debounced effect
let timeout;
effect(() => {
  console.log('Count:', state.count);
}, {
  scheduler: (fn) => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, 300); // Debounce 300ms
  }
});
```

**Computed Priority:**

Effects with `computed: true` run before regular effects:

```javascript
// This runs FIRST (computed)
effect(() => {
  derivedValue = state.count * 2;
}, { computed: true });

// This runs SECOND (regular)
effect(() => {
  console.log('Derived:', derivedValue);
});
```

This ensures computed values are always up-to-date before dependent effects run.

### `flushEffects(): Promise<void>`

Manually flush queued effects.

```javascript
import { flushEffects } from './src/Effect.js';

state.count = 5;
await flushEffects(); // Wait for effects to run
```

**Use cases:**
- Testing
- Manual timing control

---

## Built-in Components

### Loop

Renders reactive lists with key-based reconciliation.

```javascript
import { Loop } from './src/components/LoopComponent.js';

<${Loop} items="{this.todos}" item-key="id">
  <li>{this.model.text}</li>
</${Loop}>
```

**Attributes:**
- `items` - Expression returning array (required)
- `item-key` - Property name for reconciliation (default: `'id'`)

**Features:**
- Each child receives `model` prop with item value
- Key-based reconciliation reuses DOM elements
- Updates only when items array reference changes

**Limitations:**
- Naive reconciliation (no LIS optimization, O(n²) for reordering)
- No virtualization

**Example:**

```javascript
class TodoList extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({
      todos: [
        { id: 1, text: 'Task 1', done: false }
      ]
    });
  }

  addTodo = () => {
    this.state.todos = [
      ...this.state.todos,
      { id: Date.now(), text: 'New task', done: false }
    ];
  };

  render() {
    return html`
      <ul>
        <${Loop} items="{this.state.todos}" item-key="id">
          <li>
            <input type="checkbox" checked="{this.model.done}" />
            <span>{this.model.text}</span>
          </li>
        </${Loop}>
      </ul>
      <button onclick="{addTodo}">Add</button>
    `;
  }
}
```

### If

Conditional rendering.

```javascript
import { If } from './src/components/IfComponent.js';

<${If} condition="{this.isVisible}">
  <div>Content</div>
</${If}>
```

**Attributes:**
- `condition` - Expression evaluated as boolean (required)

**Features:**
- Creates/removes content based on condition
- Leaves comment node when hidden
- Child elements cloned when shown

**Example:**

```javascript
class ConditionalView extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({
      isLoggedIn: false,
      hasPermission: false
    });
  }

  render() {
    return html`
      <${If} condition="{this.state.isLoggedIn}">
        <div>Welcome back!</div>

        <${If} condition="{this.state.hasPermission}">
          <admin-panel></admin-panel>
        </${If}>
      </${If}>

      <${If} condition="{!this.state.isLoggedIn}">
        <login-form></login-form>
      </${If}>
    `;
  }
}
```

### Property

Renders RDF property values with language support and reactive updates.

```javascript
// Declarative syntax (preferred)
<span property="v-s:title"></span>

// Programmatic usage (advanced)
import PropertyComponent from './src/components/PropertyComponent.js';
```

**Attributes:**
- `property` - RDF property name (required)
- `lang` - Language filter (optional, auto-detected)
- `shadow` - Use Shadow DOM (optional)
- `about` - Model URI (optional, inherits from parent)

**Features:**
- Automatically renders property values from model
- Language filtering (e.g., `Title^^EN` vs `Title^^RU`)
- Reactive updates when model property changes
- Supports custom templates with `<slot>` or text content

**Example - Simple:**

```javascript
class PersonCard extends Component(HTMLElement) {
  render() {
    return html`
      <h1 property="v-s:title"></h1>
      <p property="v-s:description"></p>
    `;
  }
}
```

**Example - With Template:**

```javascript
render() {
  return html`
    <div property="v-s:email">
      <template>
        <a href="mailto:"><slot></slot></a>
      </template>
    </div>
  `;
}
// Renders: <a href="mailto:">user@example.com</a>
```

**Language Support:**

```javascript
// Model has: {'v-s:title': ['Hello^^EN', 'Привет^^RU']}

// User's browser lang = 'en'
<span property="v-s:title"></span>
// Renders: "Hello"

// User's browser lang = 'ru'
<span property="v-s:title"></span>
// Renders: "Привет"
```

**How it works:**
- Inherits `model` from parent component automatically
- Creates reactive effect to re-render on property changes
- Filters by document language (`document.documentElement.lang`)

### Relation

Renders related RDF resources (URI values) with automatic model loading and custom templates.

```javascript
// Declarative syntax (preferred)
<ul rel="v-s:hasTodo">
  <li>{this.model['v-s:title']}</li>
</ul>

// Programmatic usage (advanced)
import RelationComponent from './src/components/RelationComponent.js';
```

**Attributes:**
- `rel` - RDF relation property name (required)
- `shadow` - Use Shadow DOM (optional)
- `about` - Model URI (optional, inherits from parent)

**Features:**
- Automatically loads related models
- Each child receives `model` prop with related resource
- Reactive updates when relation changes
- Supports custom templates

**Example - Simple:**

```javascript
class TodoList extends Component(HTMLElement) {
  render() {
    return html`
      <ul rel="v-s:hasTodo">
        <li>{this.model['v-s:title']}</li>
      </ul>
    `;
  }
}
```

**Example - With Custom Components:**

```javascript
render() {
  return html`
    <div rel="v-s:hasAuthor">
      <person-card></person-card>
    </div>
  `;
}
// Each person-card receives related Person model
```

**Difference from Loop:**

| Feature | Relation | Loop |
|---------|----------|------|
| Data source | RDF property (URI[]) | Any array |
| Model loading | Automatic | Manual |
| Use case | Semantic relations | Generic lists |
| Reconciliation | No keys | Key-based |

**Example - Relation vs Loop:**

```javascript
// ✅ Use Relation for RDF relations
<div rel="v-s:hasAttachment">
  <file-preview></file-preview>
</div>

// ✅ Use Loop for generic arrays
<${Loop} items="{this.todos}" item-key="id">
  <todo-item></todo-item>
</${Loop}>
```

---

## Model

Represents semantic web resource with RDF properties.

### Constructor

```javascript
import Model from './src/Model.js';

// Load by URI
const model = new Model('d:MyModel');
await model.load();

// Create from data
const model = new Model({
  '@': 'd:MyModel',
  'v-s:title': [{ data: 'Title', type: 'String' }]
});

// Create new
const model = new Model();
model.id = 'd:NewModel';
model['rdf:type'] = [new Model('v-s:Person')];
```

### Static Methods

#### `Model.load(uri: string | string[]): Promise<Model | Model[]>`

Load model(s) by URI.

```javascript
const model = await Model.load('d:Person1');
const models = await Model.load(['d:Person1', 'd:Person2']);
```

### Instance Methods

#### `load(): Promise<Model>`

Load model data from backend.

```javascript
const model = new Model('d:Person1');
await model.load();
```

#### `save(): Promise<Model>`

Save model to backend.

```javascript
model['v-s:title'] = [{ data: 'New Title', type: 'String' }];
await model.save();
```

#### `remove(): Promise<void>`

Remove model from backend.

```javascript
await model.remove();
```

#### `hasValue(property: string, value?: any): boolean`

Check if property has value.

```javascript
if (model.hasValue('v-s:title')) {
  // Has title
}

if (model.hasValue('v-s:title', 'Specific Title')) {
  // Has specific title
}
```

#### `addValue(property: string, value: any): void`

Add value to property.

```javascript
model.addValue('v-s:tag', 'important');
model.addValue('v-s:tag', 'urgent');
// Now: model['v-s:tag'] = ['important', 'urgent']
```

#### `removeValue(property: string, value: any): void`

Remove value from property.

```javascript
model.removeValue('v-s:tag', 'urgent');
```

### Properties

Properties are arrays (RDF-style):

```javascript
// Read
console.log(model['v-s:title']); // [{ data: 'Title', type: 'String' }]

// Write
model['v-s:title'] = [{ data: 'New Title', type: 'String' }];

// Check
if (model['v-s:creator']) {
  // Has creator
}
```

### Events

```javascript
model.on('modified', (property, value) => {
  console.log(`${property} changed to`, value);
});

model.on('beforeSave', () => {
  console.log('About to save');
});

model.on('afterSave', () => {
  console.log('Saved successfully');
});
```

---

## Backend

Static class for backend communication.

### Authentication

```javascript
import Backend from './src/Backend.js';

Backend.init('http://localhost:8080');

await Backend.authenticate('username', 'password');
await Backend.logout();
```

### Individual Operations

```javascript
// Get
const data = await Backend.get_individual('d:Person1');

// Update
await Backend.put_individual(data);

// Delete
await Backend.remove_individual('d:Person1');
```

### Query

```javascript
const result = await Backend.query({
  query: 'v-s:Person',
  sort: "'v-s:created' desc",
  top: 100
});

console.log(result.result); // Array of URIs
```

---

## Router

Simple hash-based router.

```javascript
import Router from './src/Router.js';

const router = new Router();

router.add('#/', () => {
  console.log('Home');
});

router.add('#/user/:id', (params) => {
  console.log('User ID:', params.id);
});

if (!location.hash) {
  location.hash = '#/';
}
router.route(location.hash);
```

---

## Value

RDF value serialization/deserialization utility.

### Constructor

```javascript
import Value from './src/Value.js';

// Create from data and type
const value = new Value('John', 'String', 'EN');
const number = new Value(42, 'Integer');
const date = new Value('2024-01-01T00:00:00Z', 'Datetime');
```

### Static Methods

#### `Value.serialize(value): Value`

Auto-detects type and creates Value object.

```javascript
Value.serialize(42);              // Value { data: 42, type: 'Integer' }
Value.serialize(3.14);            // Value { data: '3.14', type: 'Decimal' }
Value.serialize(true);            // Value { data: true, type: 'Boolean' }
Value.serialize(new Date());      // Value { data: '...Z', type: 'Datetime' }
Value.serialize('d:Person1');     // Value { data: 'd:Person1', type: 'Uri' }
Value.serialize('Hello');         // Value { data: 'Hello', type: 'String' }
Value.serialize('Title^^EN');     // Value { data: 'Title', type: 'String', lang: 'EN' }
```

#### `Value.parse(value): any`

Converts Value object to JavaScript type.

```javascript
Value.parse({ data: 'Hello', type: 'String' });           // 'Hello'
Value.parse({ data: 'Title', type: 'String', lang: 'EN' }); // 'Title^^EN'
Value.parse({ data: 42, type: 'Integer' });               // 42
Value.parse({ data: '3.14', type: 'Decimal' });           // 3.14
Value.parse({ data: true, type: 'Boolean' });             // true
Value.parse({ data: '2024-01-01T00:00:00Z', type: 'Datetime' }); // Date object
Value.parse({ data: 'd:Person1', type: 'Uri' });          // Model instance
```

#### `Value.areEqual(first, second): boolean`

Compares two Value objects.

```javascript
const v1 = new Value('Hello', 'String');
const v2 = new Value('Hello', 'String');
Value.areEqual(v1, v2); // true

const v3 = new Value('Hello', 'String', 'EN');
Value.areEqual(v1, v3); // false (different lang)
```

### Instance Methods

#### `isEqual(value): boolean`

```javascript
const v1 = new Value(42, 'Integer');
const v2 = new Value(42, 'Integer');
v1.isEqual(v2); // true
```

### Properties

```javascript
const value = new Value('Hello', 'String', 'EN');
console.log(value.data);  // 'Hello'
console.log(value.type);  // 'String'
console.log(value.lang);  // 'EN'
```

### Supported Types

| Type | JavaScript | Example |
|------|------------|---------|
| `String` | string | `'Hello'` |
| `Integer` | number | `42` |
| `Decimal` | number | `3.14` |
| `Boolean` | boolean | `true` |
| `Datetime` | Date | `new Date()` |
| `Uri` | Model | `new Model('d:Entity')` |

---

## WeakCache

Weak reference cache for temporary object storage.

### Usage

```javascript
import WeakCache from './src/WeakCache.js';

const cache = new WeakCache();

// Set value
const obj = { data: 'value' };
cache.set('key', obj);

// Get value
cache.get('key'); // obj

// Check existence
cache.has('key'); // true

// Delete (automatic when obj is garbage collected)
cache.delete('key');
```

**Use case:** Model caching, temporary component state.

---

## BackendError

Custom error class for Backend API errors.

### Usage

```javascript
import Backend, { BackendError } from './src/Backend.js';

try {
  await Backend.get_individual('invalid:id');
} catch (error) {
  if (error instanceof BackendError) {
    console.log('Status:', error.status);      // HTTP status code
    console.log('Message:', error.message);    // Error message
    console.log('Response:', error.response);  // Raw response
  }
}
```

### Properties

```javascript
error.status    // HTTP status code (e.g., 404, 500)
error.message   // Error description
error.response  // Raw server response
```

---

## TypeScript

Full TypeScript definitions included.

### Component with Types

```typescript
import Component, { html } from './src/components/Component.js';
import type { Reactive } from './src/Reactive.js';

interface TodoState {
  todos: Array<{ id: number; text: string; done: boolean }>;
  filter: 'all' | 'active' | 'completed';
}

class TodoApp extends Component(HTMLElement) {
  state!: Reactive<TodoState>;

  constructor() {
    super();
    this.state = this.reactive<TodoState>({
      todos: [],
      filter: 'all'
    });
  }

  get filteredTodos() {
    return this.state.todos.filter(t =>
      this.state.filter === 'all' ||
      (this.state.filter === 'active' && !t.done) ||
      (this.state.filter === 'completed' && t.done)
    );
  }

  render() {
    return html`<div>...</div>`;
  }
}
```

### Model with Types

```typescript
import Model from './src/Model.js';

interface TodoModel extends Model {
  ['v-s:title']?: Array<{ data: string; type: string }>;
  ['v-s:completed']?: Array<{ data: boolean; type: string }>;
}

const todo = new Model('d:Todo1') as TodoModel;
await todo.load();

if (todo['v-s:title']) {
  console.log(todo['v-s:title'][0].data);
}
```

**Note:** RDF property names with colons require bracket notation in TypeScript.

### Type Definitions

All type definitions available:

```typescript
import type {
  ComponentInstance,
  ComponentConstructor,
  LoopComponentInstance,
  IfComponentInstance,
  Reactive,
  ReactiveOptions
} from './src/index.js';
```

---

## Template Functions

### `html(strings, ...values): string`

Safe template with automatic escaping.

```javascript
import { html } from './src/components/Component.js';

const userInput = '<script>alert("XSS")</script>';
const template = html`<div>${userInput}</div>`;
// Result: <div>&lt;script&gt;alert("XSS")&lt;/script&gt;</div>
```

### `raw(strings, ...values): string`

Unescaped template for trusted content.

```javascript
import { raw } from './src/components/Component.js';

const trustedHTML = '<strong>Bold</strong>';
const template = raw`<div>${trustedHTML}</div>`;
// Result: <div><strong>Bold</strong></div>
```

⚠️ **Warning:** Use only with trusted content to avoid XSS vulnerabilities.

### `safe(value: any): string | string[]`

Escapes HTML characters.

```javascript
import { safe } from './src/components/Component.js';

const escaped = safe('<script>alert("XSS")</script>');
// Result: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
```

---

## Expression Syntax

Templates support reactive expressions with `{expression}`:

### Supported

```javascript
// Property access
{this.count}
{this.user.name}

// RDF properties (no quotes needed)
{this.model['v-s:title']}
{this.model['rdfs:label']}

// Array indexing
{this.items.0.title}

// Optional chaining
{this.user?.email}
{this.items?.0?.id}
```

### Not Supported

```javascript
// ❌ Operators
{this.count + 1}
{this.price * 1.2}

// ❌ Ternary
{this.isActive ? 'Yes' : 'No'}

// ❌ Function calls
{this.formatDate(date)}
```

**Solution:** Use computed properties (getters):

```javascript
get totalPrice() {
  return this.price * 1.2;
}

get statusText() {
  return this.isActive ? 'Yes' : 'No';
}

render() {
  return html`
    <div>Price: {this.totalPrice}</div>
    <div>Status: {this.statusText}</div>
  `;
}
```

---

---

## TypeScript Types

Complete reference for exported TypeScript types.

### Core Types

#### `Reactive<T>`

Type for reactive proxy objects:

```typescript
import type { Reactive } from 'veda-client';

interface State {
  count: number;
  items: string[];
}

const state: Reactive<State> = reactive({
  count: 0,
  items: []
});
```

#### `ReactiveOptions`

Options for reactive() function:

```typescript
interface ReactiveOptions {
  onSet?: (key: string, value: any, oldValue: any) => void;
  onDelete?: (key: string) => void;
}
```

### Component Types

#### `ComponentInstance`

Base component instance type:

```typescript
import type { ComponentInstance } from 'veda-client';

const component: ComponentInstance = document.querySelector('my-component');
```

#### `LoopComponentInstance`

Loop component instance:

```typescript
import type { LoopComponentInstance } from 'veda-client';
```

#### `IfComponentInstance`

If component instance:

```typescript
import type { IfComponentInstance } from 'veda-client';
```

### Backend Types

#### `IndividualData`

RDF individual data structure:

```typescript
import type { IndividualData } from 'veda-client';

const data: IndividualData = {
  '@': 'd:Resource',
  'v-s:title': [{ data: 'Title', type: 'String' }]
};
```

#### `AuthResult`

Authentication result:

```typescript
import type { AuthResult } from 'veda-client';

const result: AuthResult = await Backend.authenticate(user, pass);
```

#### `QueryResult`

Search query result:

```typescript
import type { QueryResult } from 'veda-client';

const result: QueryResult = await Backend.query({
  query: 'v-s:Person',
  top: 100
});
```

#### `QueryParams`

Query parameters:

```typescript
import type { QueryParams } from 'veda-client';

const params: QueryParams = {
  query: 'v-s:Person',
  sort: "'v-s:created' desc",
  top: 100,
  from: 0
};
```

#### `UploadFileParams`

File upload parameters:

```typescript
import type { UploadFileParams } from 'veda-client';
```

### Value Types

#### `ValueData`

RDF value structure:

```typescript
import type { ValueData } from 'veda-client';

const value: ValueData = {
  data: 'Hello',
  type: 'String',
  lang: 'EN'
};
```

#### `ValueType`

Supported RDF types:

```typescript
import type { ValueType } from 'veda-client';

type ValueType = 'String' | 'Integer' | 'Decimal' | 'Boolean' | 'Datetime' | 'Uri';
```

#### `PrimitiveValue`

JavaScript primitive values:

```typescript
import type { PrimitiveValue } from 'veda-client';

type PrimitiveValue = string | number | boolean | Date;
```

### Model Types

#### `ModelValue`

Model property value:

```typescript
import type { ModelValue } from 'veda-client';

const title: ModelValue = model['v-s:title'];
```

### Emitter Types

#### `EmitterInstance`

Event emitter instance:

```typescript
import type { EmitterInstance } from 'veda-client';
```

### Using Types in Your Code

```typescript
import Component, { html } from 'veda-client';
import type { Reactive, ComponentInstance } from 'veda-client';

interface TodoState {
  todos: Array<{ id: number; text: string; done: boolean }>;
  filter: 'all' | 'active' | 'completed';
}

class TodoApp extends Component(HTMLElement) {
  static tag = 'todo-app';

  state!: Reactive<TodoState>;

  constructor() {
    super();
    this.state = this.reactive<TodoState>({
      todos: [],
      filter: 'all'
    });
  }

  render() {
    return html`<div>...</div>`;
  }
}
```

---

**See also:**
- [Reactivity Guide](./REACTIVITY.md) - Comprehensive reactivity tutorial
- [Limitations](./LIMITATIONS.md) - Known limitations and performance
- [Security](./SECURITY.md) - Security best practices

