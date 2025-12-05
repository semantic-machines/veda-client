# DevTools Structure

Clean separation of source code and build artifacts.

## Directory Structure

```
devtools/
├── src/                          # Source code
│   ├── hook/
│   │   ├── modules/             # ES6 class modules
│   │   │   ├── ComponentTracker.js
│   │   │   ├── ModelTracker.js
│   │   │   ├── EffectTracker.js
│   │   │   ├── SubscriptionTracker.js
│   │   │   ├── Timeline.js
│   │   │   ├── Serializer.js
│   │   │   ├── Inspector.js
│   │   │   ├── Profiler.js
│   │   │   ├── EventEmitter.js
│   │   │   └── README.md
│   │   └── index.js             # Hook entry point
│   ├── panel/
│   │   ├── components/          # Panel components
│   │   ├── utils/               # Panel utilities
│   │   └── index.js             # Panel entry point
│   ├── background.js            # Background service worker
│   ├── content-script.js        # Content script (injection)
│   └── devtools-page.js         # DevTools page script
├── dist/                         # Build output (gitignored)
│   ├── hook.js                  # Bundled hook
│   ├── panel.js                 # Bundled panel
│   ├── panel.js.map             # Source map
│   ├── background.js            # Copied
│   ├── content-script.js        # Copied
│   ├── devtools.js              # Copied
│   ├── panel.html               # Copied
│   ├── devtools.html            # Copied
│   └── manifest.json            # Copied
├── config.js                     # Configuration constants
├── types.js                      # JSDoc type definitions
├── utils/                        # Shared utilities
│   ├── common.js                # Common functions
│   └── MessageRouter.js         # Message routing
├── devtools.html                 # DevTools page HTML
├── panel-src/panel.html          # Panel HTML template
├── manifest.json                 # Extension manifest
├── build.js                      # Build script
├── watch.js                      # Watch mode
├── ARCHITECTURE.md               # Architecture docs
└── REFACTORING.md                # Refactoring history
```

## Build Process

```
Source Files → esbuild → dist/

src/hook/index.js     →  dist/hook.js       (bundled, IIFE)
src/panel/index.js    →  dist/panel.js      (bundled, IIFE + sourcemap)
src/background.js     →  dist/background.js (copied)
src/content-script.js →  dist/content-script.js (copied)
...
```

## Development Workflow

### 1. Edit Source
```bash
src/hook/modules/ComponentTracker.js
src/panel/components/ComponentsTab.js
```

### 2. Build
```bash
# One-time build
npm run build:devtools

# Watch mode (auto-rebuild on save)
node devtools/watch.js
```

### 3. Load Extension
- Go to `chrome://extensions`
- Enable Developer mode
- Click "Load unpacked"
- Select `devtools/dist` directory

### 4. Test
- Open DevTools on any page
- Check Veda tab
- Make changes, rebuild, reload

## Benefits

**Before:**
```
devtools/
├── src/
│   ├── hook.js (built file mixed with source)
│   ├── background.js
│   └── ...
├── panel/
│   ├── panel.js (built file mixed with source)
│   ├── components/
│   └── ...
└── ...
```

**After:**
```
devtools/
├── src/           # Clean source code only
│   ├── hook/
│   └── panel/
└── dist/          # All build artifacts
```

**Advantages:**
- ✅ Clear separation of source and build
- ✅ Easy to .gitignore dist/
- ✅ No confusion about what to edit
- ✅ Clean directory listing
- ✅ Standard structure (src → dist)

## npm Scripts

```json
{
  "scripts": {
    "build:devtools": "node devtools/build.js",
    "watch:devtools": "node devtools/watch.js"
  }
}
```

## Extension Loading

**Load from:** `devtools/dist/` (not `devtools/`)

The `dist/` directory contains everything needed:
- Bundled JavaScript (hook.js, panel.js)
- Copied scripts (background.js, content-script.js)
- HTML files
- manifest.json

## .gitignore

```
devtools/dist/
```

Build artifacts are regenerated, so no need to commit them.

## Clean Build

```bash
# Remove dist and rebuild
rm -rf devtools/dist
npm run build:devtools
```

## Module Resolution

esbuild resolves imports relative to source files:

```javascript
// src/panel/index.js
import { Component } from '../../../src/index.js';  // Veda framework
import { DEVTOOLS_CONFIG } from '../../config.js';   // DevTools config

// src/panel/components/ComponentsTab.js
import { Component } from '../../../../src/index.js'; // Veda framework
```

Paths go up from `src/panel/` to repo root, then into `src/`.

## Size

| File | Size |
|------|------|
| dist/hook.js | 39kb |
| dist/panel.js | 165kb |
| dist/panel.js.map | 262kb |
| **Total (without sourcemap)** | **~210kb** |

## Next Steps

1. ✅ Clean src/dist separation
2. ⏭️ Minification for production builds
3. ⏭️ TypeScript (optional)
4. ⏭️ Unit tests with Vitest

