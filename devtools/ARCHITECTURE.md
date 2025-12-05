# Veda Client DevTools - Architecture

## Overview

Veda DevTools is a Chrome extension for debugging Veda Client Framework applications. It provides insights into components, models, effects, and subscriptions.

## Architecture

```
┌─────────────────┐
│  Inspected Page │
│  (Veda App)     │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Hook   │ ← Injected into page context
    └────┬────┘   Tracks components, models, effects
         │
    ┌────▼───────────┐
    │ Content Script │ ← Bridge between page and extension
    └────┬───────────┘   Passes messages
         │
    ┌────▼───────────┐
    │   Background   │ ← Service worker
    └────┬───────────┘   Routes messages, manages connections
         │
    ┌────▼──────────┐
    │ DevTools Panel│ ← Built with Veda Client
    └───────────────┘   UI for debugging
```

### Components

#### 1. Hook (`src/hook.js`)
- **Injected into page**: Runs in the same context as the app
- **Tracks**: Components, models, effects, subscriptions
- **Memory management**: Uses `WeakRef` and `FinalizationRegistry` for automatic cleanup
- **Communication**: Posts messages to window, listens for requests

**Key responsibilities:**
- Track component lifecycle (creation, rendering, destruction)
- Monitor model updates
- Track effect dependencies and triggers
- Serialize application state for DevTools

#### 2. Content Script (`src/content-script.js`)
- **Bridge layer**: Connects page to extension
- **Injects**: hook.js into page
- **Forwards**: Messages between hook and background script

#### 3. Background (`src/background.js`)
- **Service worker**: Manages extension lifecycle
- **Message routing**: Uses `MessageRouter` for clean message handling
- **Connection management**: Tracks DevTools panel connections per tab

**Message types:**
- `get-snapshot`: Request full state snapshot
- `highlight-element`: Highlight component on page
- `inspect-element`: Set component as `$v` in console
- `start-profiling`, `stop-profiling`: Performance profiling
- `set-component-state`: Edit component state

#### 4. DevTools Panel (`panel/panel-source.js`)
- **Built with Veda**: Dogfooding the framework
- **Reactive UI**: Uses Veda's reactive system
- **Tabs**: Components, Models, Effects, Timeline, Subscriptions

**Tab components:**
- `ComponentsTab`: Tree view of components with state
- `ModelsTab`: List of tracked models
- `EffectsTab`: Effects grouped by component
- `TimelineTab`: Event timeline
- `SubscriptionsTab`: WebSocket subscriptions

## Configuration

All configuration is centralized in `config.js`:

```javascript
DEVTOOLS_CONFIG = {
  MAX_TIMELINE_EVENTS: 100,
  MAX_SUBSCRIPTION_HISTORY: 200,
  SNAPSHOT_DEBOUNCE_MS: 50,
  RECONNECT_DELAY_MS: 1000,
  // ... colors, thresholds, etc
}
```

## Data Flow

### 1. Tracking (Hook → Background → Panel)

```
Component renders
  ↓
Hook.trackComponent()
  ↓
Hook.emit('component:created')
  ↓
window.postMessage()
  ↓
Content Script receives
  ↓
chrome.runtime.sendMessage()
  ↓
Background forwards
  ↓
Panel receives & updates UI
```

### 2. Inspection (Panel → Background → Content → Page)

```
User clicks component
  ↓
Panel: onInspect(id)
  ↓
port.postMessage({ type: 'inspect-element' })
  ↓
Background routes message
  ↓
Content Script receives
  ↓
window.postMessage()
  ↓
Hook receives & sets window.$v
```

## Type System

TypeScript-style JSDoc definitions in `types.js`:

```javascript
/**
 * @typedef {Object} ComponentData
 * @property {number} id
 * @property {WeakRef<HTMLElement>} componentRef
 * @property {string} tagName
 * // ... etc
 */
```

## Utilities

### `utils/common.js`
- `debounce()`: Debounce function calls
- `throttle()`: Throttle function calls
- `deepClone()`: Deep clone with max depth
- `safeStringify()`: JSON.stringify with circular ref handling

### `panel/utils/formatters.js`
- `formatTime()`: Format timestamps
- `formatRenderTime()`: Format render times
- `formatValue()`: Format values for display

## Message Router Pattern

Centralized message handling in Background:

```javascript
const router = new MessageRouter();

router.register('get-snapshot', (msg, { tabId, port }) => {
  // Handle snapshot request
});

router.register('highlight-element', (msg, { tabId }) => {
  // Handle highlight
});

// ... more handlers

router.handle(message, context);
```

**Benefits:**
- Clean separation of concerns
- Easy to add new message types
- Testable handlers
- No code duplication

## Performance Considerations

1. **Debouncing**: Snapshot requests are debounced to avoid overwhelming the system
2. **WeakRef**: Components/models/effects use WeakRef to allow garbage collection
3. **Serialization depth**: Limited to 3 levels to avoid performance issues
4. **Timeline limit**: Only last 100 events kept in memory

## Development

### Building
```bash
cd devtools
node build.js
```

### Loading Extension
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `devtools` folder

### Hot Reload
Changes to panel code require:
1. Rebuild: `node build.js`
2. Close and reopen DevTools

Changes to background/content scripts require:
1. Reload extension in `chrome://extensions`

## Future Improvements

1. **Hook modularization**: Split 1400-line hook.js into:
   - `trackers/ComponentTracker.js`
   - `trackers/ModelTracker.js`
   - `trackers/EffectTracker.js`
   - `Timeline.js`
   - `Serializer.js`

2. **Error boundaries**: Catch and display errors gracefully

3. **Unit tests**: Test core functionality

4. **TypeScript**: Full TypeScript migration for better DX

5. **Performance profiling**: Flame charts for render performance

6. **State editing**: Edit component/model state from DevTools

