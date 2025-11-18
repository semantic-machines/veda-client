# TypeScript Usage with Loop and If Components

## Installation

Types are included automatically when you import from `veda-client`.

## Usage Examples

### Loop Component

```typescript
import { Component, Loop } from 'veda-client';
import type { LoopComponentInstance } from 'veda-client';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

class TodoList extends Component(HTMLElement) {
  static tag = 'todo-list';

  constructor() {
    super();
    this.state = this.reactive<{ todos: Todo[] }>({
      todos: []
    });
  }

  render() {
    return `
      <veda-loop items="{this.state.todos}" item-key="id">
        <li>${TodoItem.tag}</li>
      </veda-loop>
    `;
  }
}
```

### If Component

```typescript
import { Component, If } from 'veda-client';
import type { IfComponentInstance } from 'veda-client';

class ConditionalSection extends Component(HTMLElement) {
  static tag = 'conditional-section';

  constructor() {
    super();
    this.state = this.reactive({
      isVisible: false,
      hasItems: false
    });
  }

  render() {
    return `
      <veda-if condition="{this.state.isVisible}">
        <div>This content is conditionally rendered</div>
      </veda-if>

      <veda-if condition="{this.state.hasItems}">
        <item-list></item-list>
      </veda-if>
    `;
  }
}
```

### Type-Safe Attributes

```typescript
// ✅ TypeScript knows about component attributes
const loopEl = document.createElement('veda-loop') as LoopComponentInstance;
loopEl.items = '{this.todos}';      // Type-safe
loopEl['item-key'] = 'id';          // Type-safe

const ifEl = document.createElement('veda-if') as IfComponentInstance;
ifEl.condition = '{this.isVisible}'; // Type-safe
```

### Direct Component Registration

```typescript
import { Loop, If } from 'veda-client';

// Loop and If are already defined and registered
// Just import and use in templates
```

### Custom Loop with Model

```typescript
import { Component, Loop, Model } from 'veda-client';

class TodoModel extends Model {
  'v-s:title'?: string[];
  'v-s:completed'?: boolean[];
}

class TodoApp extends Component(HTMLElement) {
  static tag = 'todo-app';

  constructor() {
    super();
    this.state = this.reactive<{ todos: TodoModel[] }>({
      todos: []
    });
  }

  render() {
    return `
      <veda-loop items="{this.state.todos}" item-key="id">
        <todo-item></todo-item>
      </veda-loop>
    `;
  }
}
```

## Type Definitions

### LoopComponentInstance

```typescript
interface LoopComponentInstance extends ComponentInstance {
  items?: string;          // Expression: "{this.todos}"
  'item-key'?: string;     // Property name: "id" (default)
}
```

### IfComponentInstance

```typescript
interface IfComponentInstance extends ComponentInstance {
  condition?: string;      // Expression: "{this.isVisible}"
}
```

## Best Practices

### 1. Use Type Annotations for State

```typescript
// ✅ Good: Type-safe state
interface AppState {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
  isLoading: boolean;
}

this.state = this.reactive<AppState>({
  todos: [],
  filter: 'all',
  isLoading: false
});

// ❌ Bad: No type safety
this.state = this.reactive({
  todos: [],
  filter: 'all',
  isLoading: false
});
```

### 2. Type Component Methods

```typescript
class TodoList extends Component(HTMLElement) {
  state!: {
    todos: Todo[];
  };

  // ✅ Type-safe method
  addTodo(title: string): void {
    this.state.todos = [
      ...this.state.todos,
      { id: crypto.randomUUID(), title, completed: false }
    ];
  }

  // ✅ Type-safe computed property
  get activeTodos(): Todo[] {
    return this.state.todos.filter(t => !t.completed);
  }
}
```

### 3. Use Generics for Reusable Components

```typescript
interface ListItem {
  id: string;
}

class GenericList<T extends ListItem> extends Component(HTMLElement) {
  state!: {
    items: T[];
  };

  constructor() {
    super();
    this.state = reactive<{ items: T[] }>({
      items: []
    });
  }

  render() {
    return `
      <veda-loop items="{this.state.items}" item-key="id">
        <template>
          <li>${this.renderItem()}</li>
        </template>
      </veda-loop>
    `;
  }

  protected renderItem(): string {
    return ''; // Override in subclass
  }
}
```

## Common Patterns

### Conditional Lists

```typescript
class FilteredList extends Component(HTMLElement) {
  state!: {
    items: Item[];
    showCompleted: boolean;
  };

  get visibleItems(): Item[] {
    return this.state.showCompleted
      ? this.state.items
      : this.state.items.filter(i => !i.completed);
  }

  render() {
    return `
      <veda-loop items="{this.visibleItems}" item-key="id">
        <item-view></item-view>
      </veda-loop>
    `;
  }
}
```

### Nested Conditionals

```typescript
render() {
  return `
    <veda-if condition="{this.state.isLoggedIn}">
      <veda-if condition="{this.state.hasPermission}">
        <admin-panel></admin-panel>
      </veda-if>
    </veda-if>
  `;
}
```

### Empty State

```typescript
render() {
  return `
    <veda-if condition="{this.hasItems}">
      <veda-loop items="{this.state.items}" item-key="id">
        <item-card></item-card>
      </veda-loop>
    </veda-if>

    <veda-if condition="{!this.hasItems}">
      <div class="empty-state">No items to display</div>
    </veda-if>
  `;
}

get hasItems(): boolean {
  return this.state.items.length > 0;
}
```

## IDE Support

### VS Code

With TypeScript types, you get:
- ✅ Autocomplete for component attributes
- ✅ Type checking for state properties
- ✅ IntelliSense for methods
- ✅ Go to definition
- ✅ Find all references

### Example: Autocomplete

```typescript
const loop = document.createElement('veda-loop');
loop.  // <- VS Code shows: items, item-key, model, template, etc.
```

## Troubleshooting

### Type Errors

```typescript
// ❌ Error: Type 'string' is not assignable to type 'number'
this.state.count = '42';

// ✅ Fix: Use correct type
this.state.count = 42;
```

### Missing Types

```typescript
// If types not recognized, ensure:
// 1. tsconfig.json includes "moduleResolution": "node"
// 2. Import from 'veda-client' not './veda-client.js'
import { Loop, If } from 'veda-client'; // ✅
```

## Additional Resources

- [Component.d.ts](./Component.d.ts) - Base component types
- [LoopComponent.d.ts](./LoopComponent.d.ts) - Loop component types
- [IfComponent.d.ts](./IfComponent.d.ts) - If component types
- [REACTIVITY.md](../REACTIVITY.md) - Reactivity system guide
- [LOOP_IF_COMPONENTS.md](../LOOP_IF_COMPONENTS.md) - Component usage guide

