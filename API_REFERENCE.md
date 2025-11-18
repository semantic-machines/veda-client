# Veda Client API Reference

Complete API reference for all public classes, methods, and utilities.

## Table of Contents

- [Core Classes](#core-classes)
  - [Component](#component)
  - [Model](#model)
  - [Backend](#backend)
  - [Router](#router)
- [Reactivity](#reactivity)
  - [reactive()](#reactive)
  - [computed()](#computed)
  - [effect()](#effect)
- [Built-in Components](#built-in-components)
  - [Loop](#loop)
  - [If](#if)
- [Template Functions](#template-functions)
  - [html()](#html)
  - [raw()](#raw)
  - [safe()](#safe)
- [Utilities](#utilities)
  - [Subscription](#subscription)
  - [Emitter](#emitter)
  - [Observable](#observable)

---

## Core Classes

### Component

Base class for creating Web Components with reactivity and lifecycle management.

#### Usage

```javascript
import Component, { html } from 'veda-client';

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

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `model` | `Model` | The model instance associated with this component |
| `template` | `string` | The rendered HTML template |
| `rendered` | `Promise<void>` | Promise that resolves when component is rendered |

#### Lifecycle Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `connectedCallback()` | `Promise<void>` | Called when component is added to DOM |
| `disconnectedCallback()` | `Promise<void>` | Called when component is removed from DOM |
| `renderedCallback()` | `void` | Called after component is rendered |

#### Custom Lifecycle Hooks

| Method | Returns | Description |
|--------|---------|-------------|
| `added()` | `void \| Promise<void>` | Before first render |
| `pre()` | `void \| Promise<void>` | Before each render |
| `render()` | `string \| Promise<string>` | Returns HTML template |
| `post(fragment)` | `void \| Promise<void>` | After each render |
| `removed()` | `void \| Promise<void>` | After disconnection |

#### Reactive Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `reactive<T>(obj)` | `(obj: T) => T` | Creates reactive state for component |
| `effect(fn)` | `(fn: () => void) => () => void` | Creates effect that auto-tracks dependencies |
| `watch(getter, callback, options?)` | `<T>(getter: () => T, callback: (newValue: T, oldValue: T) => void, options?: { immediate?: boolean }) => () => void` | Watches reactive value changes |

#### Other Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `update()` | `Promise<void>` | Manually trigger re-render |
| `populate()` | `Promise<void>` | Populate component from model |

---

### Model

Represents a semantic web resource with RDF properties.

#### Usage

```javascript
import { Model } from 'veda-client';

const todo = new Model();
todo['rdf:type'] = [new Model('v-s:Todo')];
todo['v-s:title'] = ['My task'];
todo['v-s:completed'] = [false];

await todo.save();
```

#### Static Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `Model.load(uri)` | `(uri: string) => Promise<Model>` | Load model by URI |
| `Model.create(type)` | `(type: string) => Model` | Create new model of type |

#### Instance Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `load()` | `() => Promise<Model>` | Load model data from backend |
| `save()` | `() => Promise<Model>` | Save model to backend |
| `remove()` | `() => Promise<void>` | Remove model from backend |
| `hasValue(property, value)` | `(property: string, value: any) => boolean` | Check if has value |
| `addValue(property, value)` | `(property: string, value: any) => void` | Add value to property |
| `removeValue(property, value)` | `(property: string, value: any) => void` | Remove value from property |

#### Events (via Emitter)

| Event | Description |
|-------|-------------|
| `beforeLoad` | Before loading from backend |
| `afterLoad` | After loading from backend |
| `beforeSave` | Before saving to backend |
| `afterSave` | After saving to backend |
| `propertyModified` | When property is modified |

#### Event Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `on(event, handler)` | `(event: string, handler: Function) => () => void` | Subscribe to event |
| `once(event, handler)` | `(event: string, handler: Function) => () => void` | Subscribe once |
| `off(event, handler?)` | `(event: string, handler?: Function) => void` | Unsubscribe from event |
| `trigger(event, ...args)` | `(event: string, ...args: any[]) => Model` | Trigger event |

---

### Backend

Static class for interacting with Veda backend server.

#### Initialization

```javascript
import { Backend } from 'veda-client';

Backend.init('http://localhost:8080');
```

#### Authentication

| Method | Signature | Description |
|--------|-----------|-------------|
| `authenticate(login, password, secret?)` | `(login: string, password: string, secret?: string) => Promise<AuthResult>` | Authenticate user |
| `get_ticket_trusted(login)` | `(login: string) => Promise<AuthResult>` | Get trusted ticket |
| `is_ticket_valid(ticket?)` | `(ticket?: string) => Promise<any>` | Check ticket validity |
| `logout()` | `() => Promise<any>` | Logout current user |

#### Individuals (Resources)

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_individual(uri, cache?, signal?)` | `(uri: string, cache?: boolean, signal?: AbortSignal) => Promise<IndividualData>` | Get individual by URI |
| `get_individuals(uris, signal?)` | `(uris: string[], signal?: AbortSignal) => Promise<IndividualData[]>` | Get multiple individuals |
| `put_individual(individual, signal?)` | `(individual: IndividualData, signal?: AbortSignal) => Promise<any>` | Create/update individual |
| `add_to_individual(individual, signal?)` | `(individual: IndividualData, signal?: AbortSignal) => Promise<any>` | Add values to individual |
| `set_in_individual(individual, signal?)` | `(individual: IndividualData, signal?: AbortSignal) => Promise<any>` | Set values in individual |
| `remove_from_individual(individual, signal?)` | `(individual: IndividualData, signal?: AbortSignal) => Promise<any>` | Remove values from individual |
| `remove_individual(uri, signal?)` | `(uri: string, signal?: AbortSignal) => Promise<any>` | Remove individual |

#### Query

| Method | Signature | Description |
|--------|-----------|-------------|
| `query(queryStr, sort?, databases?, top?, limit?, from?, sql?, tries?, signal?)` | `(queryStr: string \| QueryParams, ...) => Promise<QueryResult>` | Execute query |
| `stored_query(data, signal?)` | `(data: any, signal?: AbortSignal) => Promise<QueryResult>` | Execute stored query |

#### Rights & Permissions

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_rights(uri, user_id?)` | `(uri: string, user_id?: string) => Promise<IndividualData>` | Get rights for resource |
| `get_rights_origin(uri)` | `(uri: string) => Promise<IndividualData>` | Get origin of rights |
| `get_membership(uri)` | `(uri: string) => Promise<IndividualData>` | Get membership info |

#### File Operations

| Method | Signature | Description |
|--------|-----------|-------------|
| `upload_file(params)` | `(params: UploadFileParams) => Promise<any>` | Upload file |

#### Module Operations

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_operation_state(module_id, wait_op_id)` | `(module_id: string, wait_op_id: number) => Promise<number>` | Get operation state |
| `wait_module(module_id, op_id, maxCalls?)` | `(module_id: string, op_id: number, maxCalls?: number) => Promise<boolean>` | Wait for module operation |

#### Error Handling

| Method | Signature | Description |
|--------|-----------|-------------|
| `onError(listener)` | `(listener: (error: BackendError) => void) => () => void` | Subscribe to errors |
| `emitError(error)` | `(error: BackendError) => void` | Emit error |

---

### Router

Simple hash-based router for SPAs.

#### Usage

```javascript
import { Router } from 'veda-client';

const router = new Router({
  '/': HomePage,
  '/about': AboutPage,
  '/user/:id': UserPage
});

router.start();
```

#### Constructor

```javascript
new Router(routes: Record<string, ComponentClass>)
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `start()` | `() => void` | Start listening to route changes |
| `stop()` | `() => void` | Stop listening |
| `navigate(path)` | `(path: string) => void` | Navigate to path |
| `getCurrentRoute()` | `() => { path: string, params: Record<string, string> }` | Get current route |

---

## Reactivity

### reactive()

Creates a reactive proxy that automatically tracks dependencies.

#### Usage

```javascript
import { reactive } from 'veda-client';

// Outside components
const state = reactive({ count: 0 });

// Inside components - use this.reactive()
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({ count: 0 });
  }
}
```

#### Signature

```typescript
function reactive<T extends object>(
  target: T,
  options?: {
    onSet?: (key: string | symbol, value: any, oldValue: any) => void;
    onDelete?: (key: string | symbol) => void;
  }
): T
```

#### Parameters

- `target`: Object to make reactive
- `options.onSet`: Callback when property is set
- `options.onDelete`: Callback when property is deleted

---

### computed()

Creates a computed property that automatically recalculates when dependencies change.

#### Usage

```javascript
import { computed } from 'veda-client';

const state = reactive({ count: 0 });
const doubled = computed(() => state.count * 2);

console.log(doubled.value); // 0
state.count = 5;
console.log(doubled.value); // 10
```

#### Signature

```typescript
function computed<T>(getter: () => T): { readonly value: T }
```

---

### effect()

Creates an effect that automatically re-runs when its dependencies change.

#### Usage

```javascript
import { reactive, effect } from 'veda-client';

const state = reactive({ count: 0 });

const cleanup = effect(() => {
  console.log('Count:', state.count);
});

state.count++; // Logs: "Count: 1"

// Cleanup
cleanup();
```

#### Signature

```typescript
function effect(
  fn: () => void,
  options?: {
    lazy?: boolean;
    scheduler?: (effect: () => void) => void;
    computed?: boolean;
  }
): () => void
```

#### Parameters

- `fn`: Effect function
- `options.lazy`: If true, don't run immediately
- `options.scheduler`: Custom scheduler for effect execution
- `options.computed`: Mark as computed effect

#### Returns

Cleanup function to stop the effect.

---

## Built-in Components

### Loop

Renders a list of items with key-based reconciliation.

#### Usage

```javascript
import { Component, html, Loop } from 'veda-client';

class TodoList extends Component(HTMLElement) {
  render() {
    return html`
      <${Loop} items="{this.todos}" item-key="id">
        <li is="${TodoItem}"></li>
      </${Loop}>
    `;
  }
}
```

#### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `items` | `string` | Expression returning array of items |
| `item-key` | `string` | Property name for item key (optional) |

#### Behavior

- Each child receives `model` prop with item value
- Uses key-based reconciliation for efficient updates
- `<template>` wrapper is optional

---

### If

Conditionally renders content based on expression.

#### Usage

```javascript
import { Component, html, If } from 'veda-client';

class MyComponent extends Component(HTMLElement) {
  render() {
    return html`
      <${If} condition="{this.state.isVisible}">
        <div>Visible content</div>
      </${If}>
    `;
  }
}
```

#### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `condition` | `string` | Expression returning boolean |

#### Behavior

- Shows/hides content based on condition
- `<template>` wrapper is optional
- Content is removed from DOM when false

---

## Template Functions

### html()

Tagged template function for creating HTML with automatic escaping.

#### Usage

```javascript
import { html } from 'veda-client';

const name = '<script>alert("XSS")</script>';
const template = html`<div>Hello, ${name}</div>`;
// Result: <div>Hello, &lt;script&gt;alert("XSS")&lt;/script&gt;</div>
```

#### Features

- Automatic HTML escaping for security
- Reactive expressions with `{expression}`
- Static interpolation with `${expression}`
- Event handlers with `onclick="{method}"`

---

### raw()

Tagged template function for raw HTML without escaping.

#### Usage

```javascript
import { raw } from 'veda-client';

const htmlContent = '<strong>Bold</strong>';
const template = raw`<div>${htmlContent}</div>`;
// Result: <div><strong>Bold</strong></div>
```

⚠️ **Warning**: Use only with trusted content to avoid XSS.

---

### safe()

Escapes dangerous HTML characters.

#### Usage

```javascript
import { safe } from 'veda-client';

const userInput = '<script>alert("XSS")</script>';
const escaped = safe(userInput);
// Result: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
```

#### Signature

```typescript
function safe(value: any): string | string[]
```

---

## Utilities

### Subscription

Real-time subscription to backend updates via WebSocket.

#### Usage

```javascript
import { Subscription } from 'veda-client';

const sub = new Subscription({
  ticket: 'auth-ticket',
  query: 'v-s:Todo',
  onUpdate: (data) => console.log('Update:', data),
  onError: (error) => console.error('Error:', error)
});

sub.start();

// Later
sub.stop();
```

#### Constructor

```typescript
new Subscription({
  ticket: string;
  query: string;
  queryDelta?: string;
  onUpdate: (data: any) => void;
  onError?: (error: Error) => void;
})
```

#### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start subscription |
| `stop()` | Stop subscription |
| `restart()` | Restart subscription |

---

### Emitter

Mixin for event emitter functionality.

#### Usage

```javascript
import { Emitter } from 'veda-client';

class MyClass extends Emitter(Object) {
  doSomething() {
    this.trigger('done', { data: 'value' });
  }
}

const instance = new MyClass();
instance.on('done', (data) => console.log(data));
instance.doSomething(); // Logs: { data: 'value' }
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `on(event, handler)` | `(event: string, handler: Function) => () => void` | Subscribe to event |
| `once(event, handler)` | `(event: string, handler: Function) => () => void` | Subscribe once |
| `off(event, handler?)` | `(event: string, handler?: Function) => void` | Unsubscribe |
| `trigger(event, ...args)` | `(event: string, ...args: any[]) => this` | Trigger event |

---

### Observable

Creates an observable object with change tracking.

#### Usage

```javascript
import { Observable } from 'veda-client';

const data = Observable({ count: 0 });

data.on('change', () => {
  console.log('Data changed:', data.count);
});

data.count = 5; // Logs: "Data changed: 5"
```

---

## Additional Utilities

### flushEffects()

Manually flush all pending effects (advanced use).

```javascript
import { flushEffects } from 'veda-client';

state.count++;
state.value++;
flushEffects(); // Execute all pending effects immediately
```

---

## Type Definitions

All types are available when using TypeScript:

```typescript
import type {
  ComponentInstance,
  ComponentConstructor,
  IndividualData,
  QueryResult,
  AuthResult,
  ReactiveOptions
} from 'veda-client';
```

---

## See Also

- [README.md](README.md) - Quick start guide
- [DOCUMENTATION.md](DOCUMENTATION.md) - Complete framework guide
- [REACTIVITY.md](REACTIVITY.md) - Reactivity system deep dive
- [COMPONENTS.md](COMPONENTS.md) - Component guide
- [TYPESCRIPT_USAGE.md](TYPESCRIPT_USAGE.md) - TypeScript examples
- [LIMITATIONS.md](LIMITATIONS.md) - Best practices and when to use alternatives

---

**Last updated**: November 2025

