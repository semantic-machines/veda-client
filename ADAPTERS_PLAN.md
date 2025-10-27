# Veda Framework Adapters - Implementation Plan

This document details the implementation plan for React and Solid adapters.

---

## 🎯 Goals

1. **Preserve Veda Models** - RDFa semantics and reactivity core
2. **Enable Framework Ecosystems** - Use React/Solid components and tools
3. **Seamless Integration** - Two-way binding, minimal boilerplate
4. **TypeScript First** - Full type safety from ontology
5. **Performance** - Match or exceed pure framework performance

---

## 🏗️ Architecture

### Core Principle: Bridge Pattern

```
┌─────────────────────────────────────┐
│     Veda Model (reactive)           │
│  ┌─────────────────────────────┐   │
│  │ reactive() Proxy             │   │
│  │ - track dependencies         │   │
│  │ - trigger effects            │   │
│  └──────────┬───────────────────┘   │
│             │                        │
└─────────────┼────────────────────────┘
              │
              │ Bridge (sync layer)
              │ - Convert Veda effects → Framework updates
              │ - Batch updates
              │ - Cleanup on unmount
              │
┌─────────────▼────────────────────────┐
│  Framework (React / Solid / Vue)     │
│  ┌─────────────────────────────┐    │
│  │ Component Rendering          │    │
│  │ - Use framework features     │    │
│  │ - Ecosystem integration      │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Key Insight

**Veda reactivity = LOW-LEVEL primitives**
- Like `track()`, `trigger()` in Vue/Solid
- Can drive ANY view layer

**Framework adapter = BRIDGE**
- Listen to Veda reactive changes
- Trigger framework re-renders
- Maintain framework lifecycle

---

## 📦 Package Structure

```
veda-client/
├── src/                    # Core (no framework deps)
│   └── ...
│
├── adapters/
│   ├── react/              # @veda/react-adapter
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts              # Public API
│   │   │   ├── VedaProvider.tsx      # Context provider
│   │   │   ├── useVedaModel.ts       # Hook: load model
│   │   │   ├── useVedaProperty.ts    # Hook: property binding
│   │   │   ├── useVedaRelation.ts    # Hook: relation array
│   │   │   ├── useVedaQuery.ts       # Hook: SPARQL query
│   │   │   ├── bridge.ts             # Veda → React sync
│   │   │   └── types.ts              # TypeScript types
│   │   ├── test/
│   │   ├── examples/
│   │   └── README.md
│   │
│   ├── solid/              # @veda/solid-adapter
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts              # Public API
│   │   │   ├── VedaContext.tsx       # Context provider
│   │   │   ├── createVedaResource.ts # Resource: load model
│   │   │   ├── createVedaProperty.ts # Signal: property
│   │   │   ├── createVedaRelation.ts # Signal: relation array
│   │   │   ├── createVedaQuery.ts    # Resource: SPARQL
│   │   │   ├── bridge.ts             # Veda → Solid sync
│   │   │   └── types.ts              # TypeScript types
│   │   ├── test/
│   │   ├── examples/
│   │   └── README.md
│   │
│   └── vue/                # @veda/vue-adapter (future)
│       └── ...
```

---

## ⚛️ React Adapter - Detailed Design

### Package: `@veda/react-adapter`

**Version:** 1.0.0  
**Dependencies:** 
- `react` ^18.0.0 (peer)
- `veda-client` ^2.0.0

### API Design

#### 1. VedaProvider (Context)

```typescript
import { VedaProvider } from '@veda/react-adapter';

function App() {
  return (
    <VedaProvider config={{
      endpoint: 'https://example.com/veda',
      auth: { ... }
    }}>
      <TodoApp />
    </VedaProvider>
  );
}
```

**Implementation:**
```typescript
// VedaProvider.tsx
import React, { createContext, useContext } from 'react';
import { VedaClient } from 'veda-client';

interface VedaConfig {
  endpoint: string;
  auth?: AuthConfig;
}

const VedaContext = createContext<VedaClient | null>(null);

export function VedaProvider({ 
  children, 
  config 
}: { 
  children: React.ReactNode; 
  config: VedaConfig;
}) {
  const client = React.useMemo(
    () => new VedaClient(config),
    [config.endpoint]
  );

  return (
    <VedaContext.Provider value={client}>
      {children}
    </VedaContext.Provider>
  );
}

export function useVedaClient() {
  const client = useContext(VedaContext);
  if (!client) throw new Error('useVedaClient must be used within VedaProvider');
  return client;
}
```

---

#### 2. useVedaModel Hook

**Usage:**
```typescript
import { useVedaModel } from '@veda/react-adapter';

function TodoApp() {
  const model = useVedaModel('d:TodoList_1');
  
  if (!model) return <div>Loading...</div>;
  
  return <div>{model['rdfs:label'][0].data}</div>;
}
```

**Implementation:**
```typescript
// useVedaModel.ts
import { useEffect, useState } from 'react';
import { effect } from 'veda-client';
import type { Model } from 'veda-client';

export function useVedaModel(modelId: string): Model | null {
  const [model, setModel] = useState<Model | null>(null);
  const [version, setVersion] = useState(0);
  const client = useVedaClient();

  // Load model
  useEffect(() => {
    let cancelled = false;
    
    client.getModel(modelId).then(m => {
      if (!cancelled) setModel(m);
    });

    return () => { cancelled = true; };
  }, [modelId]);

  // Subscribe to changes
  useEffect(() => {
    if (!model) return;

    // Create effect that triggers re-render on ANY model change
    const cleanup = effect(() => {
      // Access model to track it
      const _ = model.properties;
      // Increment version to force re-render
      setVersion(v => v + 1);
    });

    return cleanup;
  }, [model]);

  return model;
}
```

**Key insight:** Use `setVersion` to trigger React re-render when Veda model changes!

---

#### 3. useVedaProperty Hook

**Usage:**
```typescript
import { useVedaProperty } from '@veda/react-adapter';

function TodoItem({ model }) {
  const [title, setTitle] = useVedaProperty(model, 'v-s:title');
  
  return (
    <input 
      value={title} 
      onChange={e => setTitle(e.target.value)} 
    />
  );
}
```

**Implementation:**
```typescript
// useVedaProperty.ts
import { useEffect, useState, useCallback } from 'react';
import { effect } from 'veda-client';
import type { Model } from 'veda-client';

export function useVedaProperty<T = string>(
  model: Model | null,
  property: string
): [T | undefined, (value: T) => void] {
  const [value, setValue] = useState<T | undefined>(() => 
    model?.[property]?.[0]?.data
  );

  // Subscribe to property changes
  useEffect(() => {
    if (!model) return;

    const cleanup = effect(() => {
      // Track this specific property
      const newValue = model[property]?.[0]?.data;
      setValue(newValue);
    });

    return cleanup;
  }, [model, property]);

  // Setter
  const setProperty = useCallback((newValue: T) => {
    if (!model) return;
    
    // Update model (triggers Veda reactivity)
    model[property] = [{ 
      data: newValue, 
      type: typeof newValue === 'string' ? 'String' : 'Literal' 
    }];
  }, [model, property]);

  return [value, setProperty];
}
```

---

#### 4. useVedaRelation Hook

**Usage:**
```typescript
import { useVedaRelation } from '@veda/react-adapter';
import { VirtualList } from 'react-virtual';

function TodoList({ model }) {
  const todos = useVedaRelation(model, 'v-s:hasTodo');
  
  return (
    <VirtualList
      data={todos}
      itemContent={(index, todo) => (
        <TodoItem key={todo.id} model={todo} />
      )}
    />
  );
}
```

**Implementation:**
```typescript
// useVedaRelation.ts
import { useEffect, useState } from 'react';
import { effect } from 'veda-client';
import type { Model } from 'veda-client';

export function useVedaRelation(
  model: Model | null,
  relation: string
): Model[] {
  const [items, setItems] = useState<Model[]>(() => 
    model?.[relation] || []
  );

  useEffect(() => {
    if (!model) return;

    const cleanup = effect(() => {
      // Track relation array
      const newItems = model[relation] || [];
      setItems([...newItems]); // Clone for React
    });

    return cleanup;
  }, [model, relation]);

  return items;
}
```

---

#### 5. useVedaQuery Hook

**Usage:**
```typescript
import { useVedaQuery } from '@veda/react-adapter';

function SearchResults({ query }) {
  const { data, loading, error, refetch } = useVedaQuery(`
    SELECT ?item WHERE {
      ?item v-s:title ?title .
      FILTER(CONTAINS(?title, "${query}"))
    }
  `);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <ul>
      {data.map(item => (
        <li key={item.id}>{item['v-s:title'][0].data}</li>
      ))}
    </ul>
  );
}
```

**Implementation:**
```typescript
// useVedaQuery.ts
import { useEffect, useState, useCallback } from 'react';

interface QueryResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useVedaQuery<T = Model>(
  sparql: string
): QueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const client = useVedaClient();

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const results = await client.query(sparql);
      setData(results);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [sparql]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
```

---

### Bridge Implementation

**Key challenge:** Convert Veda effects → React updates

```typescript
// bridge.ts
import { effect } from 'veda-client';

/**
 * Creates a bridge between Veda reactivity and React state
 * 
 * Usage:
 *   const [value, cleanup] = createVedaBridge(
 *     () => model[property],
 *     (newValue) => setState(newValue)
 *   );
 */
export function createVedaBridge<T>(
  getter: () => T,
  setter: (value: T) => void
): () => void {
  // Create effect that calls setter when getter changes
  return effect(() => {
    const value = getter();
    setter(value);
  });
}
```

---

### TypeScript Types

```typescript
// types.ts
import type { Model as VedaModel } from 'veda-client';

export type Model = VedaModel;

export interface VedaConfig {
  endpoint: string;
  auth?: {
    username: string;
    password: string;
  };
}

export interface VedaClient {
  getModel(id: string): Promise<Model>;
  query(sparql: string): Promise<Model[]>;
  // ...
}

// Ontology-generated types (future)
export interface TodoModel extends Model {
  'v-s:title': [{ data: string; type: 'String'; lang?: string }];
  'v-s:completed': [{ data: boolean; type: 'Boolean' }];
}
```

---

## 🎯 Solid Adapter - Detailed Design

### Package: `@veda/solid-adapter`

**Version:** 1.0.0  
**Dependencies:** 
- `solid-js` ^1.8.0 (peer)
- `veda-client` ^2.0.0

### API Design

#### 1. VedaContext (Context)

```typescript
import { VedaContext } from '@veda/solid-adapter';

function App() {
  return (
    <VedaContext.Provider value={config}>
      <TodoApp />
    </VedaContext.Provider>
  );
}
```

---

#### 2. createVedaResource

**Usage:**
```typescript
import { createVedaResource } from '@veda/solid-adapter';

function TodoApp() {
  const [model] = createVedaResource('d:TodoList_1');
  
  return (
    <Show when={model()}>
      {(m) => <div>{m()['rdfs:label'][0].data}</div>}
    </Show>
  );
}
```

**Implementation:**
```typescript
// createVedaResource.ts
import { createResource, onCleanup } from 'solid-js';
import { effect } from 'veda-client';
import type { Model } from 'veda-client';

export function createVedaResource(modelId: string) {
  const client = useVedaContext();
  
  // Load model
  const [model] = createResource<Model>(
    () => modelId,
    (id) => client.getModel(id)
  );

  // Make model reactive
  const [reactiveModel, setReactiveModel] = createSignal(model());

  createEffect(() => {
    const m = model();
    if (!m) return;

    // Subscribe to Veda changes
    const cleanup = effect(() => {
      // Access model to track
      const _ = m.properties;
      // Update signal
      setReactiveModel(m);
    });

    onCleanup(cleanup);
  });

  return [reactiveModel];
}
```

---

#### 3. createVedaProperty

**Usage:**
```typescript
import { createVedaProperty } from '@veda/solid-adapter';

function TodoItem(props) {
  const [title, setTitle] = createVedaProperty(
    () => props.model, 
    'v-s:title'
  );
  
  return (
    <input 
      value={title()} 
      onInput={e => setTitle(e.target.value)} 
    />
  );
}
```

**Implementation:**
```typescript
// createVedaProperty.ts
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { effect } from 'veda-client';
import type { Model } from 'veda-client';
import type { Accessor } from 'solid-js';

export function createVedaProperty<T = string>(
  model: Accessor<Model | undefined>,
  property: string
): [Accessor<T | undefined>, (value: T) => void] {
  const [value, setValue] = createSignal<T | undefined>(
    model()?.[property]?.[0]?.data
  );

  createEffect(() => {
    const m = model();
    if (!m) return;

    const cleanup = effect(() => {
      const newValue = m[property]?.[0]?.data;
      setValue(() => newValue);
    });

    onCleanup(cleanup);
  });

  const setProperty = (newValue: T) => {
    const m = model();
    if (!m) return;
    
    m[property] = [{
      data: newValue,
      type: typeof newValue === 'string' ? 'String' : 'Literal'
    }];
  };

  return [value, setProperty];
}
```

---

### Bridge Implementation

```typescript
// bridge.ts
import { effect as vedaEffect } from 'veda-client';
import { createEffect, onCleanup } from 'solid-js';

/**
 * Creates a bridge between Veda reactivity and Solid signals
 */
export function createVedaBridge<T>(
  getter: () => T,
  setter: (value: T) => void
): void {
  createEffect(() => {
    const cleanup = vedaEffect(() => {
      const value = getter();
      setter(value);
    });

    onCleanup(cleanup);
  });
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// useVedaProperty.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useVedaProperty } from '@veda/react-adapter';

test('useVedaProperty updates on model change', async () => {
  const model = reactive({ 'v-s:title': [{ data: 'Initial' }] });
  
  const { result } = renderHook(() => 
    useVedaProperty(model, 'v-s:title')
  );

  expect(result.current[0]).toBe('Initial');

  act(() => {
    model['v-s:title'] = [{ data: 'Updated' }];
  });

  await waitFor(() => {
    expect(result.current[0]).toBe('Updated');
  });
});
```

---

### Integration Tests

```typescript
// TodoApp.test.tsx
import { render, screen } from '@testing-library/react';
import { VedaProvider } from '@veda/react-adapter';
import TodoApp from './TodoApp';

test('TodoApp renders todos', async () => {
  render(
    <VedaProvider config={testConfig}>
      <TodoApp modelId="d:TestList" />
    </VedaProvider>
  );

  await screen.findByText('Todo 1');
  expect(screen.getByText('Todo 2')).toBeInTheDocument();
});
```

---

### Performance Tests

```typescript
// benchmark.test.ts
import { benchmark } from 'kelonio';

test('useVedaRelation performance with 1000 items', async () => {
  const model = createModelWith1000Items();
  
  const time = await benchmark(() => {
    render(<TodoList model={model} />);
  });

  expect(time.mean).toBeLessThan(100); // ms
});
```

---

## 📊 Success Metrics

### React Adapter
- [ ] Two-way binding: < 1ms latency
- [ ] Memory overhead: < 1MB per 1000 models
- [ ] Bundle size: < 15kb (minified)
- [ ] TypeScript strict mode: passing
- [ ] Test coverage: > 90%
- [ ] React DevTools: working

### Solid Adapter
- [ ] Fine-grained updates: only changed components
- [ ] Memory overhead: < 500KB per 1000 models
- [ ] Bundle size: < 10kb (minified)
- [ ] TypeScript strict mode: passing
- [ ] Test coverage: > 90%
- [ ] Solid DevTools: working

---

## 🚀 Implementation Phases

### Phase 2.1: React Core (Week 1)
- [ ] VedaProvider
- [ ] useVedaModel
- [ ] useVedaProperty
- [ ] Bridge implementation
- [ ] Basic tests

### Phase 2.2: React Advanced (Week 2)
- [ ] useVedaRelation
- [ ] useVedaQuery
- [ ] TypeScript types
- [ ] Comprehensive tests

### Phase 2.3: React Examples (Week 3)
- [ ] TodoMVC example
- [ ] Large table example
- [ ] Performance benchmarks
- [ ] Documentation

### Phase 3.1: Solid Core (Week 4)
- [ ] VedaContext
- [ ] createVedaResource
- [ ] createVedaProperty
- [ ] Bridge implementation
- [ ] Basic tests

### Phase 3.2: Solid Advanced (Week 5)
- [ ] createVedaRelation
- [ ] createVedaQuery
- [ ] TypeScript types
- [ ] Comprehensive tests

### Phase 3.3: Solid Examples (Week 6)
- [ ] TodoMVC example
- [ ] Real-time dashboard
- [ ] Performance benchmarks
- [ ] Documentation

---

**Next Steps:** Start Phase 1.1 (Critical Bugs) before implementing adapters.

