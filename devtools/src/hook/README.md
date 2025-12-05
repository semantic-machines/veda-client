# Hook Modules

The DevTools hook is built from modular ES6 classes using esbuild.

## Module Structure

```
src/hook/
├── ComponentTracker.js   - Component lifecycle & rendering (210 lines)
├── ModelTracker.js       - Model instances & updates (120 lines)
├── EffectTracker.js      - Reactive effects & dependencies (190 lines)
├── SubscriptionTracker.js - WebSocket subscriptions (80 lines)
├── Timeline.js           - Event timeline (35 lines)
├── Serializer.js         - Value serialization (165 lines)
├── Inspector.js          - Element highlighting & inspection (170 lines)
├── Profiler.js           - Performance profiling (70 lines)
└── EventEmitter.js       - Event system (45 lines)

src/hook-entry.js         - Main entry point (285 lines)
```

## Building

The hook is bundled using esbuild:

```bash
# Build once
node build.js

# Watch mode (auto-rebuild on changes)
node watch.js
```

## ES6 Architecture

All modules use ES6 classes instead of factory functions:

```javascript
// Old (factory pattern)
export function createComponentTracker(emit, addToTimeline, extractState) {
  return {
    track(component) { /* ... */ }
  };
}

// New (ES6 class)
export class ComponentTracker {
  constructor(emit, addToTimeline, extractState) {
    this.emit = emit;
    // ...
  }
  
  track(component) { /* ... */ }
}
```

## Build Process

```
src/hook-entry.js (imports all modules)
  ↓ esbuild
src/hook.js (single IIFE bundle, 39kb)
  ↓ content-script.js injects
Page context
```

**Benefits:**
- ✓ Tree shaking (unused code removed)
- ✓ Modern ES6 syntax
- ✓ Proper module imports
- ✓ Watch mode for development
- ✓ Consistent with panel build

## Module APIs

### ComponentTracker

```javascript
track(component: HTMLElement): number
untrack(component: HTMLElement): void
trackStateChange(component: HTMLElement): void
trackRender(component: HTMLElement, startTime: number, recordFn: Function): void
getPerformanceStats(): Array<PerformanceStats>
```

### ModelTracker

```javascript
track(model: Object): number
trackUpdate(model: Object, recordFn: Function): void
findByModelId(modelId: string): ModelData | null
```

### EffectTracker

```javascript
track(effect: Function): number
trackDependency(effect: Function, target: Object, key: string): void
trackTrigger(effect: Function, recordFn: Function): void
untrack(effect: Function): void
```

### SubscriptionTracker

```javascript
track(id: string, updateCounter: number): void
trackUnsubscription(id: string): void
trackUpdate(id: string, updateCounter: number): void
getStats(wsConnected: boolean): Object
```

### Timeline

```javascript
add(event: string, data: Object): void
get(limit: number = 50): Array<Event>
clear(): void
```

### Serializer

```javascript
serializeValue(value: any, depth: number = 0): any
extractComponentState(component: HTMLElement): Object
getModelType(model: Object): string
serializeModelProperties(model: Object): Object
```

### Inspector

```javascript
highlightElement(componentId: number): boolean
hideHighlight(): void
inspectElement(componentId: number): boolean
scrollToElement(componentId: number): boolean
setComponentState(componentId: number, key: string, value: any): boolean
```

### Profiler

```javascript
start(): void
stop(): Object
record(type: string, data: Object): void
getSummary(): Object
```

### EventEmitter

```javascript
on(event: string, callback: Function): void
off(event: string, callback?: Function): void
emit(event: string, data: Object): void
```

## Development

### Hot Reload

Changes to hook modules require:
1. Save changes
2. Automatic rebuild (in watch mode)
3. Reload extension in `chrome://extensions`
4. Refresh inspected page

Changes to panel require:
1. Save changes
2. Automatic rebuild (in watch mode)
3. Close and reopen DevTools

### Adding a Module

1. Create `src/hook/YourModule.js`:

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

2. Import in `src/hook-entry.js`:

```javascript
import { YourModule } from './hook/YourModule.js';

const yourModule = new YourModule(dependencies);
```

3. Add to hook object:

```javascript
const hook = {
  // ...
  yourMethod: () => yourModule.yourMethod()
};
```

4. Rebuild automatically (in watch mode) or manually:

```bash
node build.js
```

## Size Comparison

| Version | Source | Built | Notes |
|---------|--------|-------|-------|
| Old Monolith | 1420 lines | 41.6kb | Single file |
| Factory Modules | 1061 lines | 37.4kb | Template injection |
| **ES6 Modules** | **1085 lines** | **39kb** | **esbuild + tree shaking** |

## Benefits of ES6 + esbuild

1. **Modern syntax**
   - ES6 classes
   - Import/export
   - Arrow functions
   - Template literals

2. **Better tooling**
   - Tree shaking
   - Dead code elimination
   - Proper source maps (for panel)
   - Fast incremental builds

3. **Developer experience**
   - Watch mode
   - Fast rebuilds (~10ms)
   - Clear error messages
   - IDE autocomplete

4. **Maintainability**
   - Standard module system
   - No custom template injection
   - Consistent with panel build
   - Easy to test

## Testing Modules

Each module can be imported and tested:

```javascript
import { ComponentTracker } from './hook/ComponentTracker.js';

describe('ComponentTracker', () => {
  it('should track component', () => {
    const tracker = new ComponentTracker(
      vi.fn(), // emit
      vi.fn(), // addToTimeline
      vi.fn()  // extractState
    );
    
    const component = document.createElement('div');
    const id = tracker.track(component);
    
    expect(id).toBeGreaterThan(0);
    expect(tracker.components.has(id)).toBe(true);
  });
});
```

## Migration from Factory Pattern

The refactoring changed from factory functions to ES6 classes:

**Before:**
```javascript
export function createTracker(deps) {
  return { method() {} };
}
```

**After:**
```javascript
export class Tracker {
  constructor(deps) {}
  method() {}
}
```

This is more standard and better supported by tooling.
