# Veda Client DevTools

Chrome extension for debugging Veda Client applications.

## Installation

### Build DevTools

First, build the DevTools by bundling Veda Client with your panel code:

```bash
npm run build:devtools
```

This will use esbuild to create a bundled `panel/panel.js` file with all Veda Client dependencies included.

### Load Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `devtools` folder from your Veda Client project

## Features

### Components View
- Shows all rendered components in your application
- Displays component state (reactive properties)
- Shows which Model is bound to each component
- Click to expand and see detailed state
- Filter components by tag name or model ID
- **Reactive updates** - state changes appear in real-time without losing focus

### Models View
- Shows all tracked RDF/semantic models
- Displays model ID and type (from rdf:type)
- Shows all RDF properties (v-s:*, rdf:*, @*)
- Click model references to navigate between models
- Filter models by ID or type

### Effects View
- Shows all active effects in your application
- Displays trigger count for each effect
- Shows when effect was last triggered
- Highlights effects that may have performance issues (>10 triggers)

### Timeline View
- Shows last 50 events in your application
- Component creation/updates
- Model creation/updates
- Provides chronological view of application behavior

## Usage

1. Build DevTools: `npm run build:devtools`
2. Open DevTools (F12)
3. Select "Veda Client" tab
4. Refresh your application page
5. DevTools will automatically connect and start tracking

## Development

The DevTools panel is built using Veda Client itself! This means:

- Fully reactive UI using Veda's reactivity system
- Uses `Loop` component for rendering lists
- Uses `If` component for conditional rendering
- State management using reactive objects

### Architecture

```
devtools/
├── build.js              # Build script (bundles with esbuild)
├── panel/
│   ├── panel.html        # DevTools panel HTML
│   ├── panel-source.js   # Source code (Veda components)
│   └── panel.js          # Bundled output (generated)
└── src/
    ├── background.js     # Service worker
    ├── content-script.js # Content script
    ├── devtools.js       # DevTools entry point
    └── hook.js           # Injected into page
```

### Rebuilding

After making changes to Veda Client framework, rebuild DevTools:

```bash
npm run build:devtools
```

Then reload the extension in `chrome://extensions/`.

## Tips

- Use filters to find specific components or models quickly
- Click on model references (blue underlined text) to navigate to that model
- Watch the Timeline to understand the sequence of events
- Monitor Effects view to identify performance issues

## Limitations

- Only tracks components that have been mounted
- Models are tracked only after they're accessed by components
- Timeline is limited to last 50 events to prevent memory issues
- DevTools must be open when the page loads to capture initial state
