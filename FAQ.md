# Frequently Asked Questions (FAQ)

Common questions and solutions for Veda Client Framework.

---

## Common Issues

### Q1: Why isn't my array updating?

**Problem:**
```javascript
this.state.items[0] = newValue;  // Not reactive!
```

**Solution:**

Array index assignment is **not reactive** by design (performance optimization).

**Use array mutation methods:**
```javascript
// ✅ Reactive - use splice
this.state.items.splice(0, 1, newValue);

// ✅ Reactive - push/pop/shift/unshift
this.state.items.push(newItem);
this.state.items.pop();
```

**Or reassign the array:**
```javascript
// ✅ Reactive - create new array reference
this.state.items = [...this.state.items];
this.state.items[0] = newValue;
this.state.items = this.state.items.slice();
```

**Why this limitation?**
- Deliberate design decision to optimize for array method performance
- Intercepting numeric keys has performance implications
- Array mutation methods (push, splice, etc.) ARE tracked

**See:** [LIMITATIONS.md section 4](./LIMITATIONS.md#4-array-index-assignment-not-reactive) for technical details.

---

### Q2: watch() vs effect() - when to use which?

**Use `effect()` when:**
- ✅ Simple side effects
- ✅ Automatic dependency tracking
- ✅ You don't need old/new values
- ✅ Multiple dependencies

```javascript
// Good for CSS classes, DOM manipulation
this.effect(() => {
  this.classList.toggle('active', this.state.active);
  this.classList.toggle('editing', this.state.editing);
});
```

**Use `watch()` when:**
- ✅ Need old/new value comparison
- ✅ Initial setup on mount (with `{ immediate: true }`)
- ✅ Reference equality checking
- ✅ Logging/analytics

```javascript
// Good for logging, comparisons
this.watch(
  () => this.state.count,
  (newVal, oldVal) => {
    console.log(`Count changed from ${oldVal} to ${newVal}`);
    analytics.track('count_changed', { from: oldVal, to: newVal });
  }
);

// Good for initial setup
this.watch(
  () => this.state.editing,
  (editing) => {
    this.classList.toggle('editing', editing);
  },
  { immediate: true } // Runs on mount
);
```

**Key difference:** `effect()` is simpler and runs immediately. `watch()` provides old/new values and can run on mount with `{ immediate: true }`.

**See:** [REACTIVITY.md - Side Effects](./REACTIVITY.md#side-effects) for detailed examples.

---

### Q3: Why is my component not re-rendering?

**Checklist:**

**1. Is state created with `this.reactive()`?**
```javascript
// ❌ Wrong
this.state = { count: 0 };

// ✅ Correct
this.state = this.reactive({ count: 0 });
```

**2. Are you modifying the state directly?**
```javascript
// ✅ Correct
this.state.count = 5;

// ❌ Wrong - reassigning this.state
this.state = { count: 5 };  // Breaks reactivity!
```

**3. For arrays, are you using mutation methods?**
```javascript
// ✅ Correct
this.state.items.push(newItem);
this.state.items = [...this.state.items, newItem];

// ❌ Wrong
this.state.items[0] = newItem;  // Not reactive!
```

**4. Are expressions in template correct?**
```javascript
// ✅ Correct
<div>{this.state.count}</div>

// ❌ Wrong - operators not supported
<div>{this.state.count + 1}</div>

// ✅ Use getter instead
get incrementedCount() {
  return this.state.count + 1;
}
<div>{this.incrementedCount}</div>
```

**5. Is Loop component updating?**
```javascript
// ❌ Wrong - no item-key
<${Loop} items="{this.items}">

// ✅ Correct - with item-key
<${Loop} items="{this.items}" item-key="id">
```

**Still not working?** Check browser console for errors and warnings.

---

## Performance

### Q4: How to handle lists with 1000+ items?

**Problem:** Loop component slows down with large lists (O(n²) reordering)

**Benchmarks:**
- 100 items: ~2ms (excellent)
- 500 items: ~17ms (good)
- 1000 items: ~54ms (noticeable)
- 2000+ items: >200ms (poor UX)

**Solution 1 - Pagination (recommended for 500-1000+ items):**
```javascript
class DataTable extends Component(HTMLElement) {
  constructor() {
    super();
    this.state = this.reactive({
      page: 0,
      pageSize: 50,
      allItems: [] // Load all data once
    });
  }

  get currentPage() {
    const { page, pageSize, allItems } = this.state;
    const start = page * pageSize;
    const end = start + pageSize;
    return allItems.slice(start, end);
  }

  nextPage() {
    this.state.page++;
  }

  prevPage() {
    if (this.state.page > 0) this.state.page--;
  }

  render() {
    return html`
      <${Loop} items="{this.currentPage}" item-key="id">
        <item-card></item-card>
      </${Loop}>

      <div class="pagination">
        <button onclick="{prevPage}">Previous</button>
        <span>Page {this.state.page + 1}</span>
        <button onclick="{nextPage}">Next</button>
      </div>
    `;
  }
}
```

**Solution 2 - Virtual Scrolling (for 10,000+ items):**

Use external library like `lit-virtualizer` or `virtual-scroller`:

```bash
npm install @lit-labs/virtualizer
```

```javascript
import { virtualize } from '@lit-labs/virtualizer/virtualize.js';

class VirtualList extends Component(HTMLElement) {
  render() {
    return html`
      <div style="height: 600px; overflow: auto;">
        ${virtualize({
          items: this.state.allItems,
          renderItem: (item) => html`<item-card .model=${item}></item-card>`
        })}
      </div>
    `;
  }
}
```

**Solution 3 - Lazy Loading (infinite scroll):**
```javascript
async connectedCallback() {
  await super.connectedCallback();

  // Intersection Observer for infinite scroll
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      this.loadMore();
    }
  });

  const sentinel = this.querySelector('.load-more-sentinel');
  if (sentinel) observer.observe(sentinel);
}

async loadMore() {
  if (this.state.loading) return;

  this.state.loading = true;
  const newItems = await this.fetchItems(this.state.page);
  this.state.items = [...this.state.items, ...newItems];
  this.state.page++;
  this.state.loading = false;
}
```

**Recommendation:**
- **< 500 items:** Use Loop component as-is
- **500-1000 items:** Use pagination
- **1000+ items:** Use virtual scrolling or pagination
- **Infinite data:** Use lazy loading with Intersection Observer

**See:** [BENCHMARKS.md - Loop Component Performance](./BENCHMARKS.md#loop-component-performance)

---

## TypeScript

### Q5: How to use TypeScript with Veda?

**Basic setup:**

**1. Install TypeScript:**
```bash
npm install --save-dev typescript
```

**2. Create tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "node",
    "allowJs": true,
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**3. Type your components:**
```typescript
import Component, { html } from 'veda-client';
import type { Reactive } from 'veda-client';

// Define state interface
interface AppState {
  count: number;
  name: string;
}

class App extends Component(HTMLElement) {
  state!: Reactive<AppState>;

  constructor() {
    super();
    this.state = this.reactive<AppState>({
      count: 0,
      name: 'Alice'
    });
  }

  increment() {
    this.state.count++;  // ✅ Type-safe
  }

  render() {
    return html`
      <div>
        <p>Count: {this.state.count}</p>
        <button onclick="{increment}">+</button>
      </div>
    `;
  }
}
```

**4. Type RDF Models:**
```typescript
import { Model } from 'veda-client';
import type { ModelValue } from 'veda-client';

// Define RDF model interface
interface TodoModel extends Model {
  ['v-s:title']?: ModelValue[];
  ['v-s:completed']?: ModelValue[];
  ['v-s:created']?: ModelValue[];
}

const todo = new Model('d:Todo_123') as TodoModel;
await todo.load();

// ✅ Type-safe access
const title = todo['v-s:title']?.[0]?.data;
const completed = todo['v-s:completed']?.[0]?.data as boolean;
```

**5. Available types:**
```typescript
import type {
  Reactive,
  ReactiveOptions,
  ComponentInstance,
  ModelValue,
  EmitterInstance
} from 'veda-client';
```

**See:** [API.md - TypeScript](./API.md#typescript) for complete guide.

---

## RDF/Model Questions

### Q6: How to work with RDF property arrays?

**Understanding RDF properties:**

In Veda, all RDF properties are **arrays** of values:

```javascript
const person = new Model('d:Person1');
await person.load();

// ❌ Wrong - not an array
console.log(person['v-s:name']);  // [{ data: 'John', type: 'String' }]

// ✅ Correct - access first element
console.log(person['v-s:name'][0]);  // { data: 'John', type: 'String' }

// ✅ Get actual value
console.log(person['v-s:name'][0]?.data);  // 'John'
```

**Common patterns:**

**Single value (most common):**
```javascript
// Read
const title = this.model['v-s:title']?.[0] || '';

// Write
this.model['v-s:title'] = ['New Title'];
```

**Multiple values (tags, categories):**
```javascript
// Read all values
const tags = this.model['v-s:tag'] || [];
console.log(tags);  // ['urgent', 'important', 'review']

// Add value
this.model.addValue('v-s:tag', 'new-tag');

// Remove value
this.model.removeValue('v-s:tag', 'old-tag');

// Replace all values
this.model['v-s:tag'] = ['tag1', 'tag2', 'tag3'];
```

**Language-specific values:**
```javascript
// Model has: ['Hello^^EN', 'Привет^^RU']
const title = this.model['v-s:title']?.[0];

// Filter by language
const englishTitle = this.model['v-s:title']
  ?.find(v => v.endsWith('^^EN'))
  ?.replace('^^EN', '');
```

**Helper method - toLabel():**
```javascript
// Automatically picks language based on browser
const label = this.model.toLabel();  // Uses rdfs:label + current language

// Custom property and language
const title = this.model.toLabel('v-s:title', ['EN']);
```

**In templates:**
```javascript
render() {
  return html`
    <!-- ✅ Access first element -->
    <h1>{this.model.v-s:title.0}</h1>

    <!-- ✅ Use getter for cleaner syntax -->
    <h1>{this.title}</h1>
  `;
}

get title() {
  return this.model['v-s:title']?.[0] || '';
}
```

**See:** [API.md - Model](./API.md#model) for complete Model API.

---

### Q7: How to traverse model relationships?

**Problem:** RDF models often have nested relationships:
```
Task → Creator → Department → Head → Email
```

**Solution 1 - Manual traversal:**
```javascript
// ❌ Verbose and error-prone
const creatorUri = task['v-s:creator']?.[0];
if (creatorUri) {
  const creator = new Model(creatorUri);
  await creator.load();

  const deptUri = creator['v-s:department']?.[0];
  if (deptUri) {
    const dept = new Model(deptUri);
    await dept.load();

    const headUri = dept['v-s:head']?.[0];
    if (headUri) {
      const head = new Model(headUri);
      await head.load();

      const email = head['v-s:email']?.[0];
      console.log(email);
    }
  }
}
```

**Solution 2 - getPropertyChain() (recommended):**
```javascript
// ✅ Clean and automatic
const email = await task.getPropertyChain(
  'v-s:creator',
  'v-s:department',
  'v-s:head',
  'v-s:email'
);

console.log(email);  // Direct value or undefined if chain breaks
```

**How getPropertyChain() works:**
1. Starts with current model
2. For each property:
   - Gets property value (first element)
   - If value is URI (Model), loads that model
   - Continues with next property
3. Returns final value or undefined

**Common use cases:**

**Get nested property:**
```javascript
// Project → Manager → Name
const managerName = await project.getPropertyChain(
  'v-s:hasManager',
  'v-s:name'
);
```

**Get deeply nested value:**
```javascript
// Employee → Office → Building → Address → City
const city = await employee.getPropertyChain(
  'v-s:hasOffice',
  'v-s:inBuilding',
  'v-s:hasAddress',
  'v-s:city'
);
```

**Check if model exists:**
```javascript
// Task → Assignee (may not exist)
const assignee = await task.getPropertyChain('v-s:assignedTo');

if (assignee instanceof Model) {
  console.log('Assignee:', assignee.id);
} else {
  console.log('No assignee');
}
```

**Caching:**
- Intermediate models are automatically cached by Model system
- Subsequent calls reuse cached models (fast)

**Limitations:**
- Always uses first array element at each step
- No filtering or multi-value traversal
- For complex queries, use Backend.query() or manual traversal

**See:** [API.md - getPropertyChain](./API.md#getpropertychainprops-stringpromisevalue) for complete documentation.

---

## Still Have Questions?

- 📖 Check [API Reference](./API.md) for complete documentation
- 🏗️ Read [Architecture Guide](./ARCHITECTURE.md) for internal details
- ⚡ See [REACTIVITY.md](./REACTIVITY.md) for reactivity tutorial
- 🐛 Review [LIMITATIONS.md](./LIMITATIONS.md) for known limitations
- 💬 Open an [issue](https://github.com/semantic-machines/veda-client/issues) for bugs or feature requests

---

**Found a bug or have a question not covered here?** Please [open an issue](https://github.com/semantic-machines/veda-client/issues) and we'll add it to the FAQ!

