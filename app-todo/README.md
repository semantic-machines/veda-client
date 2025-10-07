# TodoMVC • Veda Framework

> Classic [TodoMVC](http://todomvc.com) implementation using Veda framework

## Overview

Clean, modular implementation of the TodoMVC specification using the Veda framework - a reactive Web Components framework with RDF semantic data modeling.

## Features

### Full TodoMVC Specification

- ✅ Add todos
- ✅ Mark todos as complete
- ✅ Edit todos (double-click)
- ✅ Delete todos
- ✅ Toggle all todos
- ✅ Clear completed
- ✅ Filter by status (All/Active/Completed)
- ✅ Display active count
- ✅ Persist data to backend

### Modular Architecture

The app is split into 4 clean, reusable components:

1. **TodoApp** (158 lines) - Main coordinator component
2. **TodoHeader** (75 lines) - Input for new todos
3. **TodoItem** (187 lines) - Individual todo with edit mode
4. **TodoFooter** (126 lines) - Filters and clear button

**Total:** ~546 lines (down from 613 in monolithic version)

## Architecture

### Component Structure

```
TodoApp (coordinator)
├── TodoHeader
│   └── Emits: new-todo
├── TodoItem (×N)
│   └── Emits: toggle-todo, destroy-todo, save-todo
└── TodoFooter
    └── Emits: clear-completed
```

### Communication Pattern

**Parent ← Child:** Custom events bubble up
```javascript
// Child emits
this.dispatchEvent(new CustomEvent('new-todo', {
  detail: { title },
  bubbles: true
}));

// Parent listens
this.addEventListener('new-todo', this.handleNewTodo.bind(this));
```

**Parent → Child:** Props via attributes
```javascript
<todo-footer
  active-count="${this.activeTodos.length}"
  completed-count="${this.completedTodos.length}"
  filter="${this.filter}"
></todo-footer>
```

### Files Structure

```
app/
├── src/
│   ├── ontology/
│   │   └── todomvc.ttl          # RDF ontology
│   ├── css/
│   │   └── todomvc.css          # Base styles
│   ├── js/
│   │   ├── index.js             # Entry point
│   │   ├── routes.js            # Routing
│   │   ├── TodoApp.js           # Main component (158 lines)
│   │   ├── TodoHeader.js        # Header component (75 lines)
│   │   ├── TodoItem.js          # Item component (187 lines)
│   │   └── TodoFooter.js        # Footer component (126 lines)
│   └── index.html
└── README.md
```

## Components

### TodoApp

**Responsibilities:**
- Coordinate child components
- Manage todo list state
- Handle CRUD operations
- Apply filters

**Methods:**
```javascript
handleNewTodo(event)        // Create todo
handleToggleTodo(event)     // Toggle completion
handleDestroyTodo(event)    // Delete todo
handleSaveTodo(event)       // Update todo text
handleToggleAll()           // Toggle all todos
handleClearCompleted()      // Remove completed
```

### TodoHeader

**Responsibilities:**
- Render title and input
- Emit `new-todo` event on Enter

**Features:**
- Auto-focus input
- Clear input after submit
- Validate empty input

### TodoItem

**Responsibilities:**
- Display single todo
- Handle edit mode
- Emit events for actions

**Features:**
- Toggle checkbox
- Double-click to edit
- Escape/Enter in edit mode
- Delete button on hover

**Events:**
- `toggle-todo` - Completion toggled
- `destroy-todo` - Delete clicked
- `save-todo` - Edit submitted

### TodoFooter

**Responsibilities:**
- Show active count
- Render filter links
- Clear completed button

**Props:**
- `active-count` - Number of active todos
- `completed-count` - Number of completed
- `filter` - Current filter (all/active/completed)

**Events:**
- `clear-completed` - Clear button clicked

## Data Model

### RDF Ontology

```turtle
v-s:Todo
  rdf:type owl:Class ;
  rdfs:label "Todo" ;
.

v-s:TodoList
  rdf:type owl:Class ;
  rdfs:label "Todo List" ;
.

v-s:hasTodo
  rdf:type owl:ObjectProperty ;
  rdfs:domain v-s:TodoList ;
  rdfs:range v-s:Todo ;
.

v-s:title
  rdf:type owl:DatatypeProperty ;
  rdfs:domain v-s:Todo ;
  rdfs:range xsd:string ;
.

v-s:completed
  rdf:type owl:DatatypeProperty ;
  rdfs:domain v-s:Todo ;
  rdfs:range xsd:boolean ;
.
```

## Running

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Watch mode
pnpm run watch
```

Open `dist/app/index.html` in browser.

## Benefits of Modular Approach

### 1. Separation of Concerns
Each component has a single, clear responsibility

### 2. Reusability
`TodoItem` and `TodoFooter` can be reused in other apps

### 3. Testability
Easy to test components in isolation

### 4. Maintainability
Small files are easier to understand and modify

### 5. Team Development
Multiple developers can work on different components

## Framework Features Demonstrated

### 1. Custom Events
Clean parent-child communication using DOM events

### 2. Web Components
Real custom elements with encapsulated styles

### 3. Reactive Updates
Model changes automatically trigger re-renders

### 4. RDF Semantic Data
Data stored with meaning and relationships

### 5. Backend Integration
Built-in persistence via WebSocket

### 6. CSP Compliance
No eval(), safe expression parser

## Code Highlights

### Creating Todo (TodoApp)

```javascript
async handleNewTodo(event) {
  const { title } = event.detail;

  const todo = new Model();
  todo['rdf:type'] = [new Model('v-s:Todo')];
  todo['v-s:title'] = [title];
  todo['v-s:completed'] = [false];

  this.model.addValue('v-s:hasTodo', todo);
  await Promise.all([todo.save(), this.model.save()]);
  this.update();
}
```

### Emitting Event (TodoHeader)

```javascript
handleNewTodo(event, node) {
  if (event.keyCode !== ENTER_KEY) return;

  const title = node.value.trim();
  if (!title) return;

  this.dispatchEvent(new CustomEvent('new-todo', {
    detail: { title },
    bubbles: true
  }));

  node.value = '';
}
```

### Component Composition (TodoApp)

```javascript
render() {
  return html`
    <section class="todoapp">
      <todo-header></todo-header>

      <ul class="todo-list">
        ${this.filteredTodos.map(todo => html`
          <todo-item about="${todo.id}"></todo-item>
        `)}
      </ul>

      <todo-footer
        active-count="${this.activeTodos.length}"
        filter="${this.filter}"
      ></todo-footer>
    </section>
  `;
}
```

## Comparison with Other Frameworks

| Feature | Veda | React | Vue | Svelte |
|---------|------|-------|-----|--------|
| Components | Web Components | JSX | SFC | Svelte |
| State | RDF Models | useState | ref/reactive | stores |
| Events | DOM Events | Props | emit | dispatch |
| Persistence | Built-in | External | External | External |
| Data Model | Semantic RDF | Plain JS | Plain JS | Plain JS |

## License

MIT

## Links

- [TodoMVC](http://todomvc.com)
- [Veda Framework](https://github.com/semantic-machines/veda-client)
- [Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
