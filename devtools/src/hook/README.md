# Hook Modules

The DevTools hook has been refactored from a 1420-line monolith into 9 focused modules.

## Module Structure

```
src/hook/
├── ComponentTracker.js   - Component lifecycle & rendering
├── ModelTracker.js       - Model instances & updates
├── EffectTracker.js      - Reactive effects & dependencies
├── SubscriptionTracker.js - WebSocket subscriptions
├── Timeline.js           - Event timeline
├── Serializer.js         - Value serialization for display
├── Inspector.js          - Element highlighting & inspection
├── Profiler.js           - Performance profiling
└── EventEmitter.js       - Event system
```

## Building

The modules are combined into `src/hook.js` using the build script:

```bash
node build-hook.js
```

This reads `hook-modular-template.js` and injects all modules into it, creating a single file for injection.

## Benefits

**Before (Monolith):**
- ✗ 1420 lines in single file
- ✗ Mixed concerns
- ✗ Hard to test
- ✗ 41.6kb

**After (Modular):**
- ✓ 9 focused modules (~100-200 lines each)
- ✓ Clear separation of concerns
- ✓ Easier to test
- ✓ 37.4kb (-10%)

## Module Descriptions

### ComponentTracker
Tracks component instances, their lifecycle, rendering performance, and hierarchy.

**API:**
- `track(component)` - Register component
- `untrack(component)` - Unregister component
- `trackStateChange(component)` - Track state changes
- `trackRender(component, startTime, recordProfileEvent)` - Track render
- `getPerformanceStats()` - Get performance statistics

### ModelTracker
Tracks model instances and their updates.

**API:**
- `track(model)` - Register model
- `trackUpdate(model, recordProfileEvent)` - Track model update
- `findByModelId(modelId)` - Find model by ID

### EffectTracker
Tracks reactive effects, their triggers, and dependencies.

**API:**
- `track(effect)` - Register effect
- `trackDependency(effect, target, key)` - Track dependency access
- `trackTrigger(effect, recordProfileEvent)` - Track effect trigger
- `untrack(effect)` - Unregister effect

### SubscriptionTracker
Tracks WebSocket subscriptions to models.

**API:**
- `track(id, updateCounter)` - Track subscription
- `trackUnsubscription(id)` - Track unsubscription
- `trackUpdate(id, updateCounter)` - Track subscription update
- `getStats(wsConnected)` - Get subscription statistics

### Timeline
Maintains a rolling timeline of events.

**API:**
- `add(event, data)` - Add event to timeline
- `get(limit)` - Get recent events
- `clear()` - Clear timeline

### Serializer
Serializes values for display in DevTools.

**API:**
- `serializeValue(value, depth)` - Serialize any value
- `extractComponentState(component)` - Extract component state
- `getModelType(model)` - Get model RDF type
- `serializeModelProperties(model)` - Serialize model properties

### Inspector
Handles element highlighting and inspection in the page.

**API:**
- `highlightElement(componentId)` - Highlight element in page
- `hideHighlight()` - Hide highlight overlay
- `inspectElement(componentId)` - Set element as `$v` in console
- `scrollToElement(componentId)` - Scroll to element
- `setComponentState(componentId, key, value)` - Edit state

### Profiler
Performance profiling support.

**API:**
- `start()` - Start profiling
- `stop()` - Stop profiling and get results
- `record(type, data)` - Record profiling event
- `profiling` - Check if profiling is active

### EventEmitter
Simple event emitter for hook events.

**API:**
- `on(event, callback)` - Subscribe to event
- `off(event, callback)` - Unsubscribe from event
- `emit(event, data)` - Emit event

## Development

### Adding a New Module

1. Create `src/hook/YourModule.js`:
```javascript
export function createYourModule(dependencies) {
  return {
    yourMethod() {
      // ...
    }
  };
}
```

2. Add to `build-hook.js`:
```javascript
const modules = {
  // ...
  YourModule: fs.readFileSync(path.join(hookDir, 'YourModule.js'), 'utf8')
};
```

3. Add to template `src/hook-modular-template.js`:
```javascript
// === Module: YourModule ===
${YourModule}

// Create your module
const yourModule = createYourModule(dependencies);
```

4. Rebuild:
```bash
node build-hook.js
```

### Testing Modules

Each module can be tested in isolation:

```javascript
import { createComponentTracker } from './ComponentTracker.js';

const mockEmit = vi.fn();
const mockAddToTimeline = vi.fn();
const mockExtractState = vi.fn();

const tracker = createComponentTracker(mockEmit, mockAddToTimeline, mockExtractState);

// Test
tracker.track(component);
expect(mockEmit).toHaveBeenCalledWith('component:created', expect.any(Object));
```

## Migration Notes

The old monolithic `hook.js` is backed up as `hook-monolith.js` for reference.

Key changes:
- Removed unused `setCurrentComponent/clearCurrentComponent` methods
- Removed unused graph helper functions (`findModelByModelId`, `getShortModelId`)
- Simplified message handling
- Improved code organization

## Size Comparison

| Version | Size | Change |
|---------|------|--------|
| Monolithic | 41.6kb | - |
| Modular | 37.4kb | **-10%** |

