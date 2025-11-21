/**
 * Veda Client DevTools Panel - Built with Veda Client itself!
 */

import { Component, html, Loop, If } from '../../src/index.js';

// Main DevTools Panel Component
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

    this.port = null;
  }

  async connectedCallback() {
    await super.connectedCallback();

    console.log('[Veda DevTools Panel] Connected');
    this.connectToBackground();

    // Try to get initial snapshot, with retry if page not ready
    this.requestSnapshot();
    // Only retry if we didn't get data
    setTimeout(() => {
      if (this.state.components.length === 0) {
        this.retrySnapshot();
      }
    }, 1000);
  }

  connectToBackground() {
    console.log('[Veda DevTools Panel] Connecting to background...');
    this.port = chrome.runtime.connect({ name: 'devtools' });

    this.port.postMessage({
      type: 'init',
      tabId: chrome.devtools.inspectedWindow.tabId
    });

    this.port.onMessage.addListener((message) => {
      console.log('[Veda DevTools Panel] Received message:', message);
      this.handleMessage(message);
    });

    this.state.connected = true;
    console.log('[Veda DevTools Panel] Connected to background');
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
      // Will retry again if no data received
      setTimeout(() => {
        if (this.state.components.length === 0) {
          this.retrySnapshot(attempt + 1, maxAttempts);
        }
      }, 500);
    }, 1000);
  }

  handleMessage(message) {
    console.log('[Veda DevTools Panel] Handling message:', message.event, message.data);

    switch (message.event) {
      case 'snapshot':
        if (message.data) {
          console.log('[Veda DevTools Panel] Got snapshot:', message.data);
          // Initial load: just set the data
          this.state.components = message.data.components || [];
          this.state.models = message.data.models || [];
          this.state.effects = message.data.effects || [];
          this.state.timeline = message.data.timeline || [];
        }
        break;

      case 'component:created':
        if (message.data) {
          const existing = this.state.components.find(c => c.id === message.data.id);
          if (!existing) {
            this.state.components.push(message.data);
          }
        }
        break;

      case 'component:removed':
        if (message.data) {
          const index = this.state.components.findIndex(c => c.id === message.data.id);
          if (index !== -1) {
            this.state.components.splice(index, 1);
          }
        }
        break;

      case 'component:state-changed':
        if (message.data) {
          const component = this.state.components.find(c => c.id === message.data.id);
          if (component) {
            component.state = message.data.state;
          }
        }
        break;

      case 'model:created':
        if (message.data) {
          const existing = this.state.models.find(m => m.id === message.data.id);
          if (!existing) {
            this.state.models.push(message.data);
          }
        }
        break;

      case 'effect:created':
        if (message.data) {
          const existing = this.state.effects.find(e => e.id === message.data.id);
          if (!existing) {
            this.state.effects.push(message.data);
          }
        }
        break;

      case 'effect:triggered':
        if (message.data) {
          const effect = this.state.effects.find(e => e.id === message.data.id);
          if (effect) {
            effect.triggerCount = message.data.triggerCount;
            effect.lastTriggered = message.data.lastTriggered;
          }
        }
        break;

      case 'effect:removed':
        if (message.data) {
          const index = this.state.effects.findIndex(e => e.id === message.data.id);
          if (index !== -1) {
            this.state.effects.splice(index, 1);
          }
        }
        break;
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
    // Create new empty Set instead of clearing the proxied one
    this.state.expandedItems = new Set();
  }

  switchTab(tab) {
    this.state.activeTab = tab;
  }

  switchTabToComponents() {
    this.switchTab('components');
  }

  switchTabToModels() {
    this.switchTab('models');
  }

  switchTabToEffects() {
    this.switchTab('effects');
  }

  switchTabToTimeline() {
    this.switchTab('timeline');
  }

  handleFilterComponentsInput(e, node) {
    this.state.filterComponents = node.value;
  }

  handleFilterModelsInput(e, node) {
    this.state.filterModels = node.value;
  }

  toggleExpand(type, id) {
    const key = `${type}-${id}`;
    const expandedItems = this.state.expandedItems;
    // Use Set.prototype methods with proper context
    if (Set.prototype.has.call(expandedItems, key)) {
      Set.prototype.delete.call(expandedItems, key);
    } else {
      Set.prototype.add.call(expandedItems, key);
    }
    // Trigger reactivity
    this.state.expandedItems = new Set(expandedItems);
  }

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

  get hasEffects() {
    return this.state.effects.length > 0;
  }

  get noEffects() {
    return this.state.effects.length === 0;
  }

  // Computed properties for tab state
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

  // Computed CSS classes
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

  get statusText() {
    return this.state.connected ? 'Connected' : 'Disconnected';
  }

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

  formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return `{${Object.keys(value).length} props}`;
    return String(value);
  }

  render() {
    return html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #1e1e1e;
          color: #d4d4d4;
        }

        .toolbar {
          background: #252526;
          border-bottom: 1px solid #3c3c3c;
          padding: 8px 12px;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .toolbar button {
          background: #0e639c;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 2px;
          cursor: pointer;
          font-size: 11px;
        }

        .toolbar button:hover {
          background: #1177bb;
        }

        .status {
          margin-left: auto;
          color: ${this.state.connected ? '#4ec9b0' : '#858585'};
        }

        .main {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .sidebar {
          width: 200px;
          background: #252526;
          border-right: 1px solid #3c3c3c;
          overflow-y: auto;
        }

        .tab {
          padding: 8px 12px;
          cursor: pointer;
          border-left: 2px solid transparent;
        }

        .tab:hover {
          background: #2a2d2e;
        }

        .tab.active {
          background: #1e1e1e;
          border-left-color: #0e639c;
        }

        .content {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
        }
      </style>

      <div class="toolbar">
        <button onclick="{handleRefresh}">Refresh</button>
        <button onclick="{handleClear}">Clear</button>
        <span class="status">{this.statusText}</span>
      </div>

      <div class="main">
        <div class="sidebar">
          <div class="{this.componentsTabClass}"
               onclick="{switchTabToComponents}">
            Components ({this.state.components.length})
          </div>
          <div class="{this.modelsTabClass}"
               onclick="{switchTabToModels}">
            Models ({this.state.models.length})
          </div>
          <div class="{this.effectsTabClass}"
               onclick="{switchTabToEffects}">
            Effects ({this.state.effects.length})
          </div>
          <div class="{this.timelineTabClass}"
               onclick="{switchTabToTimeline}">
            Timeline
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
      <div class="section-title">Components ({this.filteredComponents.length})</div>
      <input type="text"
             class="filter-input"
             placeholder="Filter components..."
             value="{this.state.filterComponents}"
             oninput="{handleFilterComponentsInput}">

      <${If} condition="{this.hasFilteredComponents}">
        <${Loop} items="{this.filteredComponents}" key="id" as="item">
          <component-item :model="{item}"></component-item>
        </${Loop}>
      </${If}>

      <${If} condition="{this.noFilteredComponents}">
        <div class="empty">No components found</div>
      </${If}>
    `;
  }

  renderModels() {
    return html`
      <div class="section-title">Models ({this.filteredModels.length})</div>
      <input type="text"
             class="filter-input"
             placeholder="Filter models..."
             value="{this.state.filterModels}"
             oninput="{handleFilterModelsInput}">

      <${If} condition="{this.hasFilteredModels}">
        <${Loop} items="{this.filteredModels}" key="id" as="item">
          <model-item :model="{item}"></model-item>
        </${Loop}>
      </${If}>

      <${If} condition="{this.noFilteredModels}">
        <div class="empty">No models found</div>
      </${If}>
    `;
  }

  renderEffects() {
    return html`
      <div class="section-title">Effects ({this.state.effects.length})</div>

      <${If} condition="{this.hasEffects}">
        <${Loop} items="{this.state.effects}" key="id" as="item">
          <effect-item :model="{item}"></effect-item>
        </${Loop}>
      </${If}>

      <${If} condition="{this.noEffects}">
        <div class="empty">No effects tracked</div>
      </${If}>
    `;
  }

  renderTimeline() {
    return html`
      <div class="section-title">Event Timeline</div>
      <div class="empty">Timeline view (TODO)</div>
    `;
  }
}

// Component Item
class ComponentItem extends Component(HTMLElement) {
  static tag = 'component-item';

  render() {
    if (!this.state.model) return '';

    return html`
      <div class="item">
        <div class="item-header">
          <span class="item-id">&lt;{this.state.model.tagName}&gt;</span>
        </div>
      </div>
    `;
  }
}

// Model Item
class ModelItem extends Component(HTMLElement) {
  static tag = 'model-item';

  render() {
    if (!this.state.model) return '';

    return html`
      <div class="item">
        <div class="item-header">
          <span class="item-id">{this.state.model.modelId}</span>
        </div>
        <div class="property">
          <span class="property-key">type:</span>
          <span class="property-value">{this.state.model.type}</span>
        </div>
      </div>
    `;
  }
}

// Effect Item
class EffectItem extends Component(HTMLElement) {
  static tag = 'effect-item';

  render() {
    if (!this.state.model) return '';

    return html`
      <div class="item">
        <div class="item-header">
          <span class="item-id">Effect #{this.state.model.id}</span>
        </div>
        <div class="property">
          <span class="property-key">triggers:</span>
          <span class="property-value">{this.state.model.triggerCount}x</span>
        </div>
      </div>
    `;
  }
}

// Register components
customElements.define(DevToolsPanel.tag, DevToolsPanel);
customElements.define(ComponentItem.tag, ComponentItem);
customElements.define(ModelItem.tag, ModelItem);
customElements.define(EffectItem.tag, EffectItem);
