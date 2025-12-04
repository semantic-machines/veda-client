/**
 * Veda Client DevTools Panel - Built with Veda Client itself!
 */

import { Component, html, Loop, If } from '../../src/index.js';
import { registerComponents } from './components/index.js';

// Register child components
registerComponents();

// ============================================================================
// Main DevTools Panel Component
// ============================================================================
class DevToolsPanel extends Component(HTMLElement) {
  static tag = 'devtools-panel';

  constructor() {
    super();

    // State is automatically reactive
    this.state.connected = false;
    this.state.activeTab = 'components';
    this.state.components = [];
    this.state.models = [];
    this.state.effects = [];
    this.state.timeline = [];
    this.state.expandedItems = new Set();
    this.state.filterComponents = '';
    this.state.filterModels = '';
    this.state.filterEffects = '';
    this.state.selectedComponentId = null;
    this.state.selectedModelId = null;
    this.state.selectedEffectId = null;

    this.port = null;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async connectedCallback() {
    await super.connectedCallback();

    console.log('[Veda DevTools Panel] Connected');
    this.connectToBackground();

    // Try to get initial snapshot, with retry if page not ready
    this.requestSnapshot();
    setTimeout(() => {
      if (this.state.components.length === 0) {
        this.retrySnapshot();
      }
    }, 1000);

    // Periodic refresh to keep data fresh (every 5 seconds)
    this._refreshInterval = setInterval(() => {
      if (this.state.connected && this.port) {
        this.requestSnapshot();
      }
    }, 5000);

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeydown.bind(this));

    // Setup resizer after render
    setTimeout(() => this.setupResizer(), 0);
  }

  setupResizer() {
    // Setup resizer for all split panels
    const resizers = this.querySelectorAll('.split-resizer');
    resizers.forEach(resizer => {
      if (resizer._initialized) return;
      resizer._initialized = true;

      const rightPanel = resizer.nextElementSibling;
      if (!rightPanel) return;

      let isResizing = false;
      let startX = 0;
      let startWidth = 0;

      resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = rightPanel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      });

      const onMouseMove = (e) => {
        if (!isResizing) return;
        const diff = startX - e.clientX;
        const newWidth = Math.max(200, Math.min(600, startWidth + diff));
        rightPanel.style.width = newWidth + 'px';
      };

      const onMouseUp = () => {
        if (isResizing) {
          isResizing = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  disconnectedCallback() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
    super.disconnectedCallback?.();
  }

  // ===========================================================================
  // Communication with Background
  // ===========================================================================

  connectToBackground() {
    console.log('[Veda DevTools Panel] Connecting to background...');

    try {
      this.port = chrome.runtime.connect({ name: 'devtools' });

      this.port.postMessage({
        type: 'init',
        tabId: chrome.devtools.inspectedWindow.tabId
      });

      this.port.onMessage.addListener((message) => {
        console.log('[Veda DevTools Panel] Received message:', message);
        this.handleMessage(message);
      });

      // Handle disconnection and reconnect
      this.port.onDisconnect.addListener(() => {
        console.warn('[Veda DevTools Panel] Port disconnected, reconnecting in 1s...');
        this.state.connected = false;
        this.port = null;
        setTimeout(() => this.connectToBackground(), 1000);
      });

      this.state.connected = true;
      console.log('[Veda DevTools Panel] Connected to background');
    } catch (error) {
      console.error('[Veda DevTools Panel] Connection error:', error);
      this.state.connected = false;
      setTimeout(() => this.connectToBackground(), 2000);
    }
  }

  requestSnapshot() {
    if (!this.port) {
      console.warn('[Veda DevTools Panel] No port, cannot request snapshot');
      return;
    }

    console.log('[Veda DevTools Panel] Requesting snapshot for tab', chrome.devtools.inspectedWindow.tabId);
    this.port.postMessage({
      type: 'get-snapshot',
      tabId: chrome.devtools.inspectedWindow.tabId
    });
  }

  retrySnapshot(attempt = 1, maxAttempts = 5) {
    if (attempt > maxAttempts) {
      console.warn('[Veda DevTools Panel] Failed to get snapshot after', maxAttempts, 'attempts');
      return;
    }

    console.log('[Veda DevTools Panel] Retry snapshot attempt', attempt);
    setTimeout(() => {
      this.requestSnapshot();
      setTimeout(() => {
        if (this.state.components.length === 0) {
          this.retrySnapshot(attempt + 1, maxAttempts);
        }
      }, 500);
    }, 1000);
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  handleMessage(message) {
    console.log('[Veda DevTools Panel] Handling message:', message.event, message.data);

    // Add to timeline for real-time events
    if (message.event && message.event !== 'snapshot') {
      this.addTimelineEvent(message.event, message.data);
    }

    switch (message.event) {
      case 'snapshot':
        this.handleSnapshot(message.data);
        break;

      case 'component:created':
        this.handleComponentCreated(message.data);
        break;

      case 'component:removed':
        this.handleComponentRemoved(message.data);
        break;

      case 'component:state-changed':
        this.handleComponentStateChanged(message.data);
        break;

      case 'model:created':
        this.handleModelCreated(message.data);
        break;

      case 'model:updated':
        this.handleModelUpdated(message.data);
        break;

      case 'effect:created':
        this.handleEffectCreated(message.data);
        break;

      case 'effect:triggered':
        this.handleEffectTriggered(message.data);
        break;

      case 'effect:removed':
        this.handleEffectRemoved(message.data);
        break;
    }
  }

  handleSnapshot(data) {
    if (data) {
      console.log('[Veda DevTools Panel] Got snapshot:', data);
      this.state.components = data.components || [];
      this.state.models = data.models || [];
      this.state.effects = data.effects || [];
      this.state.timeline = data.timeline || [];
    }
  }

  handleComponentCreated(data) {
    if (data) {
      const existing = this.state.components.find(c => c.id === data.id);
      if (!existing) {
        this.state.components = [...this.state.components, data];
      }
    }
  }

  handleComponentRemoved(data) {
    if (data) {
      this.state.components = this.state.components.filter(c => c.id !== data.id);
    }
  }

  handleComponentStateChanged(data) {
    if (data) {
      const component = this.state.components.find(c => c.id === data.id);
      if (component) {
        component.state = data.state;
        this.state.components = [...this.state.components];
      }
    }
  }

  handleModelCreated(data) {
    if (data) {
      const existing = this.state.models.find(m => m.id === data.id);
      if (!existing) {
        this.state.models = [...this.state.models, data];
      }
    }
  }

  handleModelUpdated(data) {
    if (data) {
      const model = this.state.models.find(m => m.id === data.id);
      if (model) {
        model.type = data.type;
        model.isLoaded = data.isLoaded;
        model.properties = data.properties;
        model.updateCount = data.updateCount;
        this.state.models = [...this.state.models];
      }
    }
  }

  handleEffectCreated(data) {
    if (data) {
      const existing = this.state.effects.find(e => e.id === data.id);
      if (!existing) {
        this.state.effects = [...this.state.effects, data];
      }
    }
  }

  handleEffectTriggered(data) {
    if (data) {
      const effect = this.state.effects.find(e => e.id === data.id);
      if (effect) {
        effect.triggerCount = data.triggerCount;
        effect.lastTriggered = data.lastTriggered;
        this.state.effects = [...this.state.effects];
      }
    }
  }

  handleEffectRemoved(data) {
    if (data) {
      this.state.effects = this.state.effects.filter(e => e.id !== data.id);
    }
  }

  addTimelineEvent(event, data) {
    const timelineEvent = {
      id: Date.now() + Math.random(),
      event,
      data,
      timestamp: Date.now()
    };
    // Keep last 100 events
    const newTimeline = [...this.state.timeline, timelineEvent].slice(-100);
    this.state.timeline = newTimeline;
  }

  // ===========================================================================
  // User Actions
  // ===========================================================================

  handleKeydown(e) {
    // R - Refresh
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
      this.handleRefresh();
    }
    // 1-4 - Switch tabs
    if (e.key >= '1' && e.key <= '4' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
      const tabs = ['components', 'models', 'effects', 'timeline'];
      this.state.activeTab = tabs[parseInt(e.key) - 1];
    }
  }

  handleRefresh() {
    this.requestSnapshot();
  }

  handleClear() {
    this.state.components = [];
    this.state.models = [];
    this.state.effects = [];
    this.state.timeline = [];
    this.state.expandedItems = new Set();
    this.state.selectedItemId = null;
  }

  handleForceGC() {
    // Request GC on the inspected page
    chrome.devtools.inspectedWindow.eval(
      `(function() {
        if (window.gc) {
          window.gc();
          console.log('[Veda DevTools] Forced GC via gc()');
          return 'gc() called';
        } else {
          // Try to trigger GC by allocating and releasing memory
          console.log('[Veda DevTools] gc() not available, trying memory pressure...');
          const arrays = [];
          for (let i = 0; i < 100; i++) {
            arrays.push(new Array(100000).fill(Math.random()));
          }
          arrays.length = 0;
          console.log('[Veda DevTools] Memory pressure applied, GC should run soon');
          return 'memory pressure applied';
        }
      })()`,
      (result, error) => {
        if (error) {
          console.warn('[Veda DevTools] Could not force GC:', error);
        } else {
          console.log('[Veda DevTools] Force GC result:', result);
        }
        // Refresh snapshot after GC (give it time)
        setTimeout(() => this.requestSnapshot(), 500);
      }
    );
  }

  switchTab(tab) {
    this.state.activeTab = tab;
    // Setup resizers after DOM updates
    requestAnimationFrame(() => this.setupResizer());
  }

  switchTabToComponents = () => this.switchTab('components');
  switchTabToModels = () => this.switchTab('models');
  switchTabToEffects = () => this.switchTab('effects');
  switchTabToTimeline = () => this.switchTab('timeline');

  navigateToModel(modelId) {
    this.state.activeTab = 'models';
    this.state.filterModels = modelId;
    const model = this.state.models.find(m => m.modelId === modelId);
    if (model) {
      this.state.selectedModelId = model.id;
    }
    requestAnimationFrame(() => this.setupResizer());
  }

  navigateToComponentModel = () => {
    const modelId = this.selectedComponentModelId;
    if (modelId) {
      this.navigateToModel(modelId);
    }
  }

  selectComponent = (id) => {
    this.state.selectedComponentId = id;
  }

  selectModel = (id) => {
    this.state.selectedModelId = id;
  }

  selectEffect = (id) => {
    this.state.selectedEffectId = id;
  }

  handleFilterComponentsInput(e) {
    this.state.filterComponents = e.target.value;
  }

  handleFilterModelsInput(e) {
    this.state.filterModels = e.target.value;
  }

  handleFilterEffectsInput(e) {
    this.state.filterEffects = e.target.value;
  }

  clearFilterComponents = () => {
    this.state.filterComponents = '';
  }

  clearFilterModels = () => {
    this.state.filterModels = '';
  }

  clearFilterEffects = () => {
    this.state.filterEffects = '';
  }

  get hasFilterComponents() {
    return this.state.filterComponents.length > 0;
  }

  get hasFilterModels() {
    return this.state.filterModels.length > 0;
  }

  get hasFilterEffects() {
    return this.state.filterEffects.length > 0;
  }

  toggleExpand(type, id) {
    const key = `${type}-${id}`;
    const expandedItems = new Set(this.state.expandedItems);
    if (expandedItems.has(key)) {
      expandedItems.delete(key);
    } else {
      expandedItems.add(key);
    }
    this.state.expandedItems = expandedItems;
  }

  isExpanded(type, id) {
    const key = `${type}-${id}`;
    return this.state.expandedItems.has(key);
  }

  // ===========================================================================
  // Computed Properties - Filters
  // ===========================================================================

  get filteredComponents() {
    const filter = this.state.filterComponents.toLowerCase();
    if (!filter) return this.state.components;

    return this.state.components.filter(c =>
      c.tagName.toLowerCase().includes(filter) ||
      (c.modelId && c.modelId.toLowerCase().includes(filter))
    );
  }

  // Returns only root components (those without parent)
  get rootComponents() {
    const filter = this.state.filterComponents.toLowerCase();
    let components = this.state.components;

    // If filtering, show flat list
    if (filter) {
      return components.filter(c =>
        c.tagName.toLowerCase().includes(filter) ||
        (c.modelId && c.modelId.toLowerCase().includes(filter))
      );
    }

    // Otherwise, show only roots for tree view
    return components.filter(c => c.parentId === null);
  }

  get filteredModels() {
    const filter = this.state.filterModels.toLowerCase();
    if (!filter) return this.state.models;

    return this.state.models.filter(m =>
      m.modelId.toLowerCase().includes(filter) ||
      (m.type && m.type.toLowerCase().includes(filter))
    );
  }

  get filteredEffects() {
    const filter = this.state.filterEffects.toLowerCase();
    if (!filter) return this.state.effects;

    return this.state.effects.filter(e =>
      String(e.id).includes(filter)
    );
  }

  get hasFilteredComponents() {
    return this.filteredComponents.length > 0;
  }

  get noFilteredComponents() {
    return this.filteredComponents.length === 0;
  }

  get hasFilteredModels() {
    return this.filteredModels.length > 0;
  }

  get noFilteredModels() {
    return this.filteredModels.length === 0;
  }

  get hasFilteredEffects() {
    return this.filteredEffects.length > 0;
  }

  get noFilteredEffects() {
    return this.filteredEffects.length === 0;
  }

  get hasTimeline() {
    return this.state.timeline.length > 0;
  }

  get noTimeline() {
    return this.state.timeline.length === 0;
  }

  get reversedTimeline() {
    return [...this.state.timeline].reverse();
  }

  // ===========================================================================
  // Computed Properties - Tab State
  // ===========================================================================

  get isComponentsTabActive() {
    return this.state.activeTab === 'components';
  }

  get isModelsTabActive() {
    return this.state.activeTab === 'models';
  }

  get isEffectsTabActive() {
    return this.state.activeTab === 'effects';
  }

  get isTimelineTabActive() {
    return this.state.activeTab === 'timeline';
  }

  // ===========================================================================
  // Computed Properties - CSS Classes
  // ===========================================================================

  get componentsTabClass() {
    return this.isComponentsTabActive ? 'tab active' : 'tab';
  }

  get modelsTabClass() {
    return this.isModelsTabActive ? 'tab active' : 'tab';
  }

  get effectsTabClass() {
    return this.isEffectsTabActive ? 'tab active' : 'tab';
  }

  get timelineTabClass() {
    return this.isTimelineTabActive ? 'tab active' : 'tab';
  }

  get statusClass() {
    return this.state.connected ? 'status connected' : 'status disconnected';
  }

  get statusText() {
    return this.state.connected ? 'Connected' : 'Disconnected';
  }

  get hotEffectsCount() {
    return this.state.effects.filter(e => e.triggerCount > 10).length;
  }

  get hasHotEffects() {
    return this.hotEffectsCount > 0;
  }

  // Selected component - returns empty object if none selected to avoid null errors
  get selectedComponent() {
    if (!this.state.selectedComponentId) return null;
    return this.state.components.find(c => c.id === this.state.selectedComponentId) || null;
  }

  // Safe accessor that never returns null (for template bindings)
  get selectedComponentSafe() {
    return this.selectedComponent || {
      id: 0,
      tagName: '',
      modelId: null,
      parentId: null,
      childIds: [],
      state: {},
      createdAt: null,
      renderCount: 0
    };
  }

  get hasSelectedComponent() {
    return this.selectedComponent !== null;
  }

  get noSelectedComponent() {
    return this.selectedComponent === null;
  }

  get selectedComponentStateEntries() {
    const comp = this.selectedComponent;
    if (!comp?.state) return [];
    return Object.entries(comp.state).map(([key, value]) => ({
      id: key,
      key,
      formattedValue: this.formatValue(value)
    }));
  }

  get selectedComponentHasState() {
    return this.selectedComponentStateEntries.length > 0;
  }

  get selectedComponentCreatedAt() {
    const comp = this.selectedComponent;
    return comp ? this.formatTime(comp.createdAt) : '-';
  }

  get selectedComponentChildCount() {
    const comp = this.selectedComponent;
    return comp?.childIds?.length || 0;
  }

  get selectedComponentTagName() {
    return this.selectedComponentSafe.tagName;
  }

  get selectedComponentId() {
    return this.selectedComponentSafe.id;
  }

  get selectedComponentModelId() {
    return this.selectedComponentSafe.modelId;
  }

  get selectedComponentParentId() {
    return this.selectedComponentSafe.parentId;
  }

  get selectedComponentRenderCount() {
    return this.selectedComponentSafe.renderCount;
  }

  // Selected Model
  get selectedModel() {
    if (!this.state.selectedModelId) return null;
    return this.state.models.find(m => m.id === this.state.selectedModelId) || null;
  }

  get selectedModelSafe() {
    return this.selectedModel || {
      id: 0,
      modelId: '',
      type: '',
      isLoaded: false,
      properties: {},
      createdAt: null,
      updateCount: 0
    };
  }

  get hasSelectedModel() {
    return this.selectedModel !== null;
  }

  get noSelectedModel() {
    return this.selectedModel === null;
  }

  get selectedModelInternalId() {
    return this.selectedModelSafe.id;
  }

  get selectedModelUri() {
    return this.selectedModelSafe.modelId || '';
  }

  get selectedModelType() {
    return this.selectedModelSafe.type || 'Unknown';
  }

  get selectedModelIsLoaded() {
    return this.selectedModelSafe.isLoaded;
  }

  get selectedModelCreatedAt() {
    return this.formatTime(this.selectedModelSafe.createdAt);
  }

  get selectedModelUpdateCount() {
    return this.selectedModelSafe.updateCount;
  }

  get selectedModelPropertyEntries() {
    const model = this.selectedModel;
    if (!model?.properties) return [];
    return Object.entries(model.properties)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => {
        const { text, links } = this.formatValueWithLinks(value);
        return {
          id: key,
          key,
          text,
          links
        };
      });
  }

  formatValueWithLinks(value) {
    if (value === null) return { text: 'null', links: [] };
    if (value === undefined) return { text: 'undefined', links: [] };
    if (typeof value === 'boolean') return { text: String(value), links: [] };
    if (typeof value === 'number') return { text: String(value), links: [] };
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return { text: new Date(value).toLocaleString(), links: [] };
      }
      if (value.includes('^^')) {
        const [text, lang] = value.split('^^');
        return { text: `"${text}" [${lang}]`, links: [] };
      }
      const str = value.length > 80 ? value.slice(0, 80) + '...' : value;
      return { text: `"${str}"`, links: [] };
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return { text: '[]', links: [] };
      const links = [];
      const textParts = [];
      for (const item of value) {
        if (typeof item === 'object' && item._type === 'Model') {
          links.push(item.id);
        } else {
          textParts.push(this.formatSingleValue(item));
        }
      }
      return { text: textParts.join(', '), links };
    }
    if (typeof value === 'object') {
      if (value._type === 'Model') {
        return { text: '', links: [value.id] };
      }
      return { text: JSON.stringify(value).slice(0, 50), links: [] };
    }
    return { text: String(value), links: [] };
  }

  get selectedModelHasProperties() {
    const entries = this.selectedModelPropertyEntries;
    return !!(entries && entries.length);
  }

  // Selected Effect
  get selectedEffect() {
    if (!this.state.selectedEffectId) return null;
    return this.state.effects.find(e => e.id === this.state.selectedEffectId) || null;
  }

  get selectedEffectSafe() {
    return this.selectedEffect || {
      id: 0,
      createdAt: null,
      triggerCount: 0,
      lastTriggered: null,
      source: ''
    };
  }

  get hasSelectedEffect() {
    return this.selectedEffect !== null;
  }

  get noSelectedEffect() {
    return this.selectedEffect === null;
  }

  get selectedEffectId() {
    return this.selectedEffectSafe.id;
  }

  get selectedEffectCreatedAt() {
    return this.formatTime(this.selectedEffectSafe.createdAt);
  }

  get selectedEffectTriggerCount() {
    return this.selectedEffectSafe.triggerCount;
  }

  get selectedEffectLastTriggered() {
    return this.formatTime(this.selectedEffectSafe.lastTriggered);
  }

  get selectedEffectSource() {
    return this.selectedEffectSafe.source || '';
  }

  get selectedEffectIsHot() {
    return this.selectedEffectSafe.triggerCount > 10;
  }

  formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      // Check if it's a date
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value).toLocaleString();
      }
      // Check if it's a localized string (contains ^^)
      if (value.includes('^^')) {
        const [text, lang] = value.split('^^');
        return `"${text}" [${lang}]`;
      }
      const str = value.length > 80 ? value.slice(0, 80) + '...' : value;
      return `"${str}"`;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      // Format array items
      const items = value.slice(0, 5).map(v => this.formatSingleValue(v));
      if (value.length > 5) {
        items.push(`+${value.length - 5} more`);
      }
      return items.join(', ');
    }
    if (typeof value === 'object') {
      if (value._type === 'Model') return value.id;
      return JSON.stringify(value).slice(0, 50);
    }
    return String(value);
  }

  formatSingleValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value).toLocaleString();
      }
      if (value.includes('^^')) {
        const [text, lang] = value.split('^^');
        return `"${text}" [${lang}]`;
      }
      const str = value.length > 40 ? value.slice(0, 40) + '...' : value;
      return `"${str}"`;
    }
    if (typeof value === 'object' && value._type === 'Model') {
      return value.id;
    }
    return String(value);
  }

  getValueClass(value) {
    if (value === null) return 'value-null';
    if (value === undefined) return 'value-undefined';
    if (typeof value === 'boolean') return 'value-boolean';
    if (typeof value === 'number') return 'value-number';
    if (typeof value === 'string') return 'value-string';
    if (Array.isArray(value)) return 'value-array';
    if (typeof value === 'object') return 'value-object';
    return 'value-unknown';
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  formatTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }

  formatRelativeTime(timestamp) {
    if (!timestamp) return '-';
    const diff = Date.now() - timestamp;
    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return this.formatTime(timestamp);
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  render() {
    return html`
      <div class="toolbar">
        <button class="btn btn-primary" onclick="{handleRefresh}" title="Refresh (R)">
          <span class="icon">↻</span> Refresh
        </button>
        <button class="btn btn-secondary" onclick="{handleClear}" title="Clear all">
          <span class="icon">✕</span> Clear
        </button>
        <button class="btn btn-secondary" onclick="{handleForceGC}" title="Force garbage collection on page">
          <span class="icon">🗑</span> Force GC
        </button>
        <div class="toolbar-spacer"></div>
        <div class="stats">
          <span class="stat">
            <span class="stat-icon">◆</span>
            <span class="stat-value">{this.state.components.length}</span>
            <span class="stat-label">components</span>
          </span>
          <span class="stat">
            <span class="stat-icon">◇</span>
            <span class="stat-value">{this.state.models.length}</span>
            <span class="stat-label">models</span>
          </span>
          <span class="stat">
            <span class="stat-icon">⚡</span>
            <span class="stat-value">{this.state.effects.length}</span>
            <span class="stat-label">effects</span>
          </span>
        </div>
        <div class="{this.statusClass}">
          <span class="status-dot"></span>
          {this.statusText}
        </div>
      </div>

      <div class="main">
        <div class="sidebar">
          <div class="{this.componentsTabClass}" onclick="{switchTabToComponents}">
            <span class="tab-icon">◆</span>
            <span class="tab-label">Components</span>
            <span class="tab-count">{this.state.components.length}</span>
          </div>
          <div class="{this.modelsTabClass}" onclick="{switchTabToModels}">
            <span class="tab-icon">◇</span>
            <span class="tab-label">Models</span>
            <span class="tab-count">{this.state.models.length}</span>
          </div>
          <div class="{this.effectsTabClass}" onclick="{switchTabToEffects}">
            <span class="tab-icon">⚡</span>
            <span class="tab-label">Effects</span>
            <span class="tab-count">{this.state.effects.length}</span>
          </div>
          <div class="{this.timelineTabClass}" onclick="{switchTabToTimeline}">
            <span class="tab-icon">◷</span>
            <span class="tab-label">Timeline</span>
            <span class="tab-count">{this.state.timeline.length}</span>
          </div>

          <div class="sidebar-footer">
            <div class="keyboard-hints">
              <span class="hint"><kbd>R</kbd> Refresh</span>
              <span class="hint"><kbd>1-4</kbd> Tabs</span>
            </div>
          </div>
        </div>

        <div class="content">
          <${If} condition="{this.isComponentsTabActive}">
            ${this.renderComponents()}
          </${If}>
          <${If} condition="{this.isModelsTabActive}">
            ${this.renderModels()}
          </${If}>
          <${If} condition="{this.isEffectsTabActive}">
            ${this.renderEffects()}
          </${If}>
          <${If} condition="{this.isTimelineTabActive}">
            ${this.renderTimeline()}
          </${If}>
        </div>
      </div>
    `;
  }

  renderComponents() {
    return html`
      <div class="split-panel">
        <div class="split-left">
          <div class="panel-header">
            <h2 class="panel-title">Components</h2>
            <span class="panel-count">{this.state.components.length}</span>
            <div class="filter-wrapper">
              <input type="text"
                     class="filter-input"
                     placeholder="Filter..."
                     value="{this.state.filterComponents}"
                     oninput="{handleFilterComponentsInput}">
              <${If} condition="{this.hasFilterComponents}">
                <button class="filter-clear" onclick="{clearFilterComponents}" title="Clear">×</button>
              </${If}>
            </div>
          </div>

          <div class="items-list component-tree">
            <${If} condition="{this.hasFilteredComponents}">
              <${Loop} items="{this.rootComponents}" key="id" as="item">
                <component-item
                  :data="{item}"
                  :all-components="{this.state.components}"
                  :depth="{0}"
                  :selected-id="{this.state.selectedComponentId}"
                  :on-select="{this.selectComponent}">
                </component-item>
              </${Loop}>
            </${If}>

            <${If} condition="{this.noFilteredComponents}">
              <div class="empty-state">
                <div class="empty-icon">◆</div>
                <div class="empty-text">No components</div>
              </div>
            </${If}>
          </div>
        </div>

        <div class="split-resizer"></div>

        <div class="split-right">
          <${If} condition="{this.hasSelectedComponent}">
            ${this.renderComponentDetails()}
          </${If}>

          <${If} condition="{this.noSelectedComponent}">
            <div class="empty-state">
              <div class="empty-icon">←</div>
              <div class="empty-text">Select a component</div>
              <div class="empty-hint">Click on a component in the tree to see its details</div>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }

  renderComponentDetails() {
    return html`
      <div class="details-panel">
        <div class="details-header">
          <span class="details-tag">&lt;{this.selectedComponentTagName}&gt;</span>
          <span class="details-id">#{this.selectedComponentId}</span>
        </div>

        <div class="details-section">
          <div class="details-section-title">State</div>
          <div class="details-properties">
            <${If} condition="{this.selectedComponentModelId}">
              <div class="details-property">
                <span class="details-prop-key">model</span>
                <span class="details-prop-value details-model-link" onclick="{navigateToComponentModel}">{this.selectedComponentModelId}</span>
              </div>
            </${If}>
            <${Loop} items="{this.selectedComponentStateEntries}" key="id" as="entry">
              <div class="details-property">
                <span class="details-prop-key">{entry.key}</span>
                <span class="details-prop-value">{entry.formattedValue}</span>
              </div>
            </${Loop}>
          </div>
        </div>

        <div class="details-section">
          <div class="details-section-title">Info</div>
          <div class="details-properties">
            <div class="details-property">
              <span class="details-prop-key">Created</span>
              <span class="details-prop-value">{this.selectedComponentCreatedAt}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Renders</span>
              <span class="details-prop-value">{this.selectedComponentRenderCount}</span>
            </div>
            <${If} condition="{this.selectedComponentParentId}">
              <div class="details-property">
                <span class="details-prop-key">Parent ID</span>
                <span class="details-prop-value">#{this.selectedComponentParentId}</span>
              </div>
            </${If}>
            <${If} condition="{this.selectedComponentChildCount}">
              <div class="details-property">
                <span class="details-prop-key">Children</span>
                <span class="details-prop-value">{this.selectedComponentChildCount} components</span>
              </div>
            </${If}>
          </div>
        </div>
      </div>
    `;
  }

  renderModels() {
    return html`
      <div class="split-panel">
        <div class="split-left">
          <div class="panel-header">
            <h2 class="panel-title">Models</h2>
            <span class="panel-count">{this.state.models.length}</span>
            <div class="filter-wrapper">
              <input type="text"
                     class="filter-input"
                     placeholder="Filter..."
                     value="{this.state.filterModels}"
                     oninput="{handleFilterModelsInput}">
              <${If} condition="{this.hasFilterModels}">
                <button class="filter-clear" onclick="{clearFilterModels}" title="Clear">×</button>
              </${If}>
            </div>
          </div>

          <div class="items-list">
            <${If} condition="{this.hasFilteredModels}">
              <${Loop} items="{this.filteredModels}" key="id" as="item">
                <model-item
                  :data="{item}"
                  :selected-id="{this.state.selectedModelId}"
                  :on-select="{this.selectModel}">
                </model-item>
              </${Loop}>
            </${If}>

            <${If} condition="{this.noFilteredModels}">
              <div class="empty-state">
                <div class="empty-icon">◇</div>
                <div class="empty-text">No models</div>
              </div>
            </${If}>
          </div>
        </div>

        <div class="split-resizer" data-panel="models"></div>

        <div class="split-right">
          <${If} condition="{this.hasSelectedModel}">
            ${this.renderModelDetails()}
          </${If}>

          <${If} condition="{this.noSelectedModel}">
            <div class="empty-state">
              <div class="empty-icon">←</div>
              <div class="empty-text">Select a model</div>
              <div class="empty-hint">Click on a model to see its properties</div>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }

  renderModelDetails() {
    return html`
      <div class="details-panel">
        <div class="details-header">
          <span class="details-tag">{this.selectedModelUri}</span>
          <span class="details-id">#{this.selectedModelInternalId}</span>
        </div>

        <div class="details-section">
          <div class="details-section-title">Info</div>
          <div class="details-properties">
            <div class="details-property">
              <span class="details-prop-key">Type</span>
              <span class="details-prop-value">{this.selectedModelType}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Loaded</span>
              <span class="details-prop-value">{this.selectedModelIsLoaded}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Created</span>
              <span class="details-prop-value">{this.selectedModelCreatedAt}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Updates</span>
              <span class="details-prop-value">{this.selectedModelUpdateCount}</span>
            </div>
          </div>
        </div>

        <div class="details-section">
          <div class="details-section-title">Properties</div>
          <div class="details-properties">
            <${Loop} items="{this.selectedModelPropertyEntries}" key="id" as="entry">
              <div class="details-property">
                <span class="details-prop-key">{entry.key}:</span>
                <property-value :text="{entry.text}" :links="{entry.links}"></property-value>
              </div>
            </${Loop}>
          </div>
        </div>
      </div>
    `;
  }

  renderEffects() {
    return html`
      <div class="split-panel">
        <div class="split-left">
          <div class="panel-header">
            <h2 class="panel-title">Effects</h2>
            <span class="panel-count">{this.state.effects.length}</span>
            <${If} condition="{this.hasHotEffects}">
              <span class="badge badge-warning">{this.hotEffectsCount} hot</span>
            </${If}>
            <div class="filter-wrapper">
              <input type="text"
                     class="filter-input"
                     placeholder="Filter..."
                     value="{this.state.filterEffects}"
                     oninput="{handleFilterEffectsInput}">
              <${If} condition="{this.hasFilterEffects}">
                <button class="filter-clear" onclick="{clearFilterEffects}" title="Clear">×</button>
              </${If}>
            </div>
          </div>

          <div class="items-list">
            <${If} condition="{this.hasFilteredEffects}">
              <${Loop} items="{this.filteredEffects}" key="id" as="item">
                <effect-item
                  :data="{item}"
                  :selected-id="{this.state.selectedEffectId}"
                  :on-select="{this.selectEffect}">
                </effect-item>
              </${Loop}>
            </${If}>

            <${If} condition="{this.noFilteredEffects}">
              <div class="empty-state">
                <div class="empty-icon">⚡</div>
                <div class="empty-text">No effects</div>
              </div>
            </${If}>
          </div>
        </div>

        <div class="split-resizer" data-panel="effects"></div>

        <div class="split-right">
          <${If} condition="{this.hasSelectedEffect}">
            ${this.renderEffectDetails()}
          </${If}>

          <${If} condition="{this.noSelectedEffect}">
            <div class="empty-state">
              <div class="empty-icon">←</div>
              <div class="empty-text">Select an effect</div>
              <div class="empty-hint">Click on an effect to see its details</div>
            </div>
          </${If}>
        </div>
      </div>
    `;
  }

  renderEffectDetails() {
    return html`
      <div class="details-panel">
        <div class="details-header">
          <span class="details-tag">Effect #{this.selectedEffectId}</span>
          <${If} condition="{this.selectedEffectIsHot}">
            <span class="badge badge-warning">hot</span>
          </${If}>
        </div>

        <div class="details-section">
          <div class="details-section-title">Info</div>
          <div class="details-properties">
            <div class="details-property">
              <span class="details-prop-key">Created</span>
              <span class="details-prop-value">{this.selectedEffectCreatedAt}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Triggers</span>
              <span class="details-prop-value">{this.selectedEffectTriggerCount}</span>
            </div>
            <div class="details-property">
              <span class="details-prop-key">Last triggered</span>
              <span class="details-prop-value">{this.selectedEffectLastTriggered}</span>
            </div>
          </div>
        </div>

        <${If} condition="{this.selectedEffectSource}">
          <div class="details-section">
            <div class="details-section-title">Source</div>
            <pre class="effect-source">{this.selectedEffectSource}</pre>
          </div>
        </${If}>
      </div>
    `;
  }

  renderTimeline() {
    return html`
      <div class="panel-header">
        <h2 class="panel-title">Timeline</h2>
        <span class="panel-count">{this.state.timeline.length} events</span>
      </div>

      <div class="timeline-container">
        <${If} condition="{this.hasTimeline}">
          <${Loop} items="{this.reversedTimeline}" key="id" as="item">
            <timeline-item :data="{item}"></timeline-item>
          </${Loop}>
        </${If}>

        <${If} condition="{this.noTimeline}">
          <div class="empty-state">
            <div class="empty-icon">◷</div>
            <div class="empty-text">No events yet</div>
            <div class="empty-hint">Events will appear here in real-time as your app runs</div>
          </div>
        </${If}>
      </div>
    `;
  }
}

// Register main panel component
customElements.define(DevToolsPanel.tag, DevToolsPanel);
