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
    this.state.selectedItemId = null;

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
      const expandedItems = new Set(this.state.expandedItems);
      expandedItems.add(`model-${model.id}`);
      this.state.expandedItems = expandedItems;
    }
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
      <div class="panel-header">
        <h2 class="panel-title">Components</h2>
        <span class="panel-count">{this.filteredComponents.length} of {this.state.components.length}</span>
      </div>
      <input type="text"
             class="filter-input"
             placeholder="Filter by tag name or model ID..."
             value="{this.state.filterComponents}"
             oninput="{handleFilterComponentsInput}">

      <div class="items-list">
        <${If} condition="{this.hasFilteredComponents}">
          <${Loop} items="{this.filteredComponents}" key="id" as="item">
            <component-item :data="{item}"></component-item>
          </${Loop}>
        </${If}>

        <${If} condition="{this.noFilteredComponents}">
          <div class="empty-state">
            <div class="empty-icon">◆</div>
            <div class="empty-text">No components found</div>
            <div class="empty-hint">Components will appear here when your app renders Veda components</div>
          </div>
        </${If}>
      </div>
    `;
  }

  renderModels() {
    return html`
      <div class="panel-header">
        <h2 class="panel-title">Models</h2>
        <span class="panel-count">{this.filteredModels.length} of {this.state.models.length}</span>
      </div>
      <input type="text"
             class="filter-input"
             placeholder="Filter by model ID or type..."
             value="{this.state.filterModels}"
             oninput="{handleFilterModelsInput}">

      <div class="items-list">
        <${If} condition="{this.hasFilteredModels}">
          <${Loop} items="{this.filteredModels}" key="id" as="item">
            <model-item :data="{item}"></model-item>
          </${Loop}>
        </${If}>

        <${If} condition="{this.noFilteredModels}">
          <div class="empty-state">
            <div class="empty-icon">◇</div>
            <div class="empty-text">No models found</div>
            <div class="empty-hint">Models will appear here when components load RDF data</div>
          </div>
        </${If}>
      </div>
    `;
  }

  renderEffects() {
    return html`
      <div class="panel-header">
        <h2 class="panel-title">Effects</h2>
        <span class="panel-count">{this.filteredEffects.length} of {this.state.effects.length}</span>
        <${If} condition="{this.hotEffectsCount > 0}">
          <span class="badge badge-warning">{this.hotEffectsCount} hot</span>
        </${If}>
      </div>
      <input type="text"
             class="filter-input"
             placeholder="Filter by effect ID..."
             value="{this.state.filterEffects}"
             oninput="{handleFilterEffectsInput}">

      <div class="items-list">
        <${If} condition="{this.hasFilteredEffects}">
          <${Loop} items="{this.filteredEffects}" key="id" as="item">
            <effect-item :data="{item}"></effect-item>
          </${Loop}>
        </${If}>

        <${If} condition="{this.noFilteredEffects}">
          <div class="empty-state">
            <div class="empty-icon">⚡</div>
            <div class="empty-text">No effects tracked</div>
            <div class="empty-hint">Effects will appear here when reactive state changes</div>
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
