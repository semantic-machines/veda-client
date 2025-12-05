# Hook Modules

ES6 class modules for tracking reactive state in the inspected page.

## Structure

```
modules/
├── ComponentTracker.js    - Component lifecycle & rendering
├── ModelTracker.js        - Model instances & updates
├── EffectTracker.js       - Reactive effects & dependencies
├── SubscriptionTracker.js - WebSocket subscriptions
├── Timeline.js            - Event timeline
├── Serializer.js          - Value serialization for DevTools
├── Inspector.js           - Element highlighting & inspection
├── Profiler.js            - Performance profiling
└── EventEmitter.js        - Event system
```

## Build

All modules are bundled into `dist/hook.js` via esbuild:

```bash
# Build
node build.js

# Watch mode
node watch.js
```

## Module APIs

Each module is an ES6 class with clear dependencies injected via constructor.

### ComponentTracker
```javascript
constructor(emit, addToTimeline, extractState)
track(component): number
untrack(component): void
trackStateChange(component): void
trackRender(component, startTime, recordFn): void
getPerformanceStats(): Array
```

### ModelTracker
```javascript
constructor(emit, addToTimeline, serializeProperties, getModelType)
track(model): number
trackUpdate(model, recordFn): void
findByModelId(modelId): Object | null
```

### EffectTracker
```javascript
constructor(emit, addToTimeline, componentToId)
track(effect): number
trackDependency(effect, target, key): void
trackTrigger(effect, recordFn): void
untrack(effect): void
```

### SubscriptionTracker
```javascript
constructor(emit)
track(id, updateCounter): void
trackUnsubscription(id): void
trackUpdate(id, updateCounter): void
getStats(wsConnected): Object
```

### Timeline
```javascript
constructor(maxEvents)
add(event, data): void
get(limit): Array
clear(): void
```

### Serializer
```javascript
serializeValue(value, depth): any
extractComponentState(component): Object
getModelType(model): string
serializeModelProperties(model): Object
```

### Inspector
```javascript
constructor(components)
highlightElement(componentId): boolean
hideHighlight(): void
inspectElement(componentId): boolean
scrollToElement(componentId): boolean
setComponentState(componentId, key, value): boolean
```

### Profiler
```javascript
start(): void
stop(): Object
record(type, data): void
getSummary(): Object
```

### EventEmitter
```javascript
on(event, callback): void
off(event, callback): void
emit(event, data): void
```

## Adding a Module

1. Create `modules/YourModule.js`:

```javascript
export class YourModule {
  constructor(dependencies) {
    // ...
  }
  
  yourMethod() {
    // ...
  }
}
```

2. Import in `index.js`:

```javascript
import { YourModule } from './modules/YourModule.js';

const yourModule = new YourModule(dependencies);
```

3. Add to hook object:

```javascript
const hook = {
  yourMethod: () => yourModule.yourMethod()
};
```

4. Rebuild (automatic in watch mode).

## Testing

Each module can be imported and tested independently:

```javascript
import { ComponentTracker } from './modules/ComponentTracker.js';

const tracker = new ComponentTracker(
  vi.fn(), // emit
  vi.fn(), // addToTimeline
  vi.fn()  // extractState
);

const component = document.createElement('div');
const id = tracker.track(component);

expect(id).toBeGreaterThan(0);
```

