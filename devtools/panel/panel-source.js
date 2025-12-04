/**
 * Veda Client DevTools Panel - Built with Veda Client itself!
 */

import { Component, html, If } from '../../src/index.js';
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

    // Connection state
    this.state.connected = false;
    this.state.activeTab = 'components';

    // Data from hook
    this.state.components = [];
    this.state.models = [];
    this.state.effects = [];
    this.state.timeline = [];
    this.state.graphNodes = [];
    this.state.graphEdges = [];
    this.state.activeSubscriptions = [];
    this.state.subscriptionHistory = [];
    this.state.wsConnected = false;
    this.state.navigateToModelId = null;

    this.port = null;
    this._snapshotDebounceTimer = null;
  }

  // Debounced snapshot request - groups rapid events into single request
  requestSnapshotDebounced = () => {
    if (this._snapshotDebounceTimer) {
      clearTimeout(this._snapshotDebounceTimer);
    }
    this._snapshotDebounceTimer = setTimeout(() => {
      this._snapshotDebounceTimer = null;
      this.requestSnapshot();
    }, 50);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async connectedCallback() {
    await super.connectedCallback();

    console.log('[Veda DevTools Panel] Connected');
    this.connectToBackground();

    // Try to get initial snapshot
    this.requestSnapshot();
    setTimeout(() => {
      if (this.state.components.length === 0) {
        this.retrySnapshot();
      }
    }, 1000);

    // Fallback polling (every 30s) - ensures eventual consistency
    this._refreshInterval = setInterval(() => {
      if (this.state.connected && this.port) {
        this.requestSnapshot();
      }
    }, 30000);

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeydown.bind(this));

    // Setup resizer for split panels
    this.setupResizer();

    // Hide highlight when DevTools panel closes
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('pagehide', this.handleBeforeUnload);
  }

  handleBeforeUnload = () => {
    if (this.port) {
      this.port.postMessage({
        type: 'hide-highlight',
        tabId: chrome.devtools.inspectedWindow.tabId
      });
    }
  }

  setupResizer() {
    // Use event delegation for resizers (works with dynamically created elements)
    let isResizing = false;
    let currentResizer = null;
    let startX = 0;
    let startWidth = 0;
    let rightPanel = null;

    document.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('split-resizer')) {
        isResizing = true;
        currentResizer = e.target;
        rightPanel = currentResizer.nextElementSibling;
        if (rightPanel) {
          startX = e.clientX;
          startWidth = rightPanel.offsetWidth;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing || !rightPanel) return;
      const diff = startX - e.clientX;
      const newWidth = Math.max(200, Math.min(600, startWidth + diff));
      rightPanel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        currentResizer = null;
        rightPanel = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  disconnectedCallback() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
    // Hide highlight when DevTools closes
    if (this.port) {
      this.port.postMessage({
        type: 'hide-highlight',
        tabId: chrome.devtools.inspectedWindow.tabId
      });
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
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(() => {
        console.warn('[Veda DevTools Panel] Port disconnected, reconnecting...');
        this.state.connected = false;
        this.port = null;
        setTimeout(() => this.connectToBackground(), 1000);
      });

      this.state.connected = true;

      // Request snapshot immediately after connection
      this.requestSnapshot();
    } catch (error) {
      console.error('[Veda DevTools Panel] Connection error:', error);
      this.state.connected = false;
      setTimeout(() => this.connectToBackground(), 2000);
    }
  }

  requestSnapshot() {
    if (!this.port) return;
    this.port.postMessage({
      type: 'get-snapshot',
      tabId: chrome.devtools.inspectedWindow.tabId
    });
  }

  retrySnapshot(attempt = 1, maxAttempts = 5) {
    if (attempt > maxAttempts) return;
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
    if (message.event && message.event !== 'snapshot') {
      this.addTimelineEvent(message.event, message.data);
    }

    switch (message.event) {
      case 'snapshot':
        this.handleSnapshot(message.data);
        break;
      case 'component:created':
      case 'component:removed':
      case 'component:state-changed':
      case 'model:created':
      case 'model:updated':
      case 'effect:created':
      case 'effect:triggered':
      case 'effect:removed':
      case 'subscription:added':
      case 'subscription:removed':
        // Request debounced snapshot to get fresh data
        this.requestSnapshotDebounced();
        break;
    }
  }

  handleSnapshot(data) {
    if (!data) return;

    this.state.components = data.components || [];
    this.state.models = data.models || [];
    this.state.effects = data.effects || [];
    this.state.timeline = data.timeline || [];

    if (data.graph) {
      this.state.graphNodes = data.graph.nodes || [];
      this.state.graphEdges = data.graph.edges || [];
    }

    if (data.subscriptions) {
      this.state.activeSubscriptions = data.subscriptions.active || [];
      this.state.subscriptionHistory = data.subscriptions.history || [];
      this.state.wsConnected = data.subscriptions.wsConnected || false;
    }
  }

  addTimelineEvent(event, data) {
    const timelineEvent = {
      id: Date.now() + Math.random(),
      event,
      data,
      timestamp: Date.now()
    };
    this.state.timeline = [...this.state.timeline, timelineEvent].slice(-100);
  }

  // ===========================================================================
  // User Actions
  // ===========================================================================

  handleKeydown(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.ctrlKey || e.metaKey) return;

    if (e.key === 'r') {
      this.handleRefresh();
    }
    if (e.key >= '1' && e.key <= '6') {
      const tabs = ['components', 'models', 'effects', 'timeline', 'graph', 'subscriptions'];
      this.state.activeTab = tabs[parseInt(e.key) - 1];
    }
  }

  handleRefresh = () => {
    this.requestSnapshot();
  }

  handleClear = () => {
    this.state.components = [];
    this.state.models = [];
    this.state.effects = [];
    this.state.timeline = [];
    this.state.graphNodes = [];
    this.state.graphEdges = [];
    this.state.activeSubscriptions = [];
    this.state.subscriptionHistory = [];
  }

  handleForceGC = () => {
    chrome.devtools.inspectedWindow.eval(
      `(function() {
        if (window.gc) {
          window.gc();
          return 'gc() called';
        } else {
          const arrays = [];
          for (let i = 0; i < 100; i++) {
            arrays.push(new Array(100000).fill(Math.random()));
          }
          arrays.length = 0;
          return 'memory pressure applied';
        }
      })()`,
      (result, error) => {
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
  switchTabToGraph = () => this.switchTab('graph');
  switchTabToSubscriptions = () => this.switchTab('subscriptions');

  navigateToModel = (modelId) => {
    this.state.activeTab = 'models';
    this.state.navigateToModelId = modelId;
  }

  handleInspectComponent = (componentId) => {
    if (!this.port) return;
    // Highlight element in page
    this.port.postMessage({
      type: 'highlight-element',
      tabId: chrome.devtools.inspectedWindow.tabId,
      componentId
    });
    // Store as $v in console
    this.port.postMessage({
      type: 'inspect-element',
      tabId: chrome.devtools.inspectedWindow.tabId,
      componentId
    });
  }

  // ===========================================================================
  // Computed Properties
  // ===========================================================================

  get isComponentsTabActive() { return this.state.activeTab === 'components'; }
  get isModelsTabActive() { return this.state.activeTab === 'models'; }
  get isEffectsTabActive() { return this.state.activeTab === 'effects'; }
  get isTimelineTabActive() { return this.state.activeTab === 'timeline'; }
  get isGraphTabActive() { return this.state.activeTab === 'graph'; }
  get isSubscriptionsTabActive() { return this.state.activeTab === 'subscriptions'; }

  get componentsTabClass() { return this.isComponentsTabActive ? 'tab active' : 'tab'; }
  get modelsTabClass() { return this.isModelsTabActive ? 'tab active' : 'tab'; }
  get effectsTabClass() { return this.isEffectsTabActive ? 'tab active' : 'tab'; }
  get timelineTabClass() { return this.isTimelineTabActive ? 'tab active' : 'tab'; }
  get graphTabClass() { return this.isGraphTabActive ? 'tab active' : 'tab'; }
  get subscriptionsTabClass() { return this.isSubscriptionsTabActive ? 'tab active' : 'tab'; }

  get statusClass() { return this.state.connected ? 'status connected' : 'status disconnected'; }
  get statusText() { return this.state.connected ? 'Connected' : 'Disconnected'; }

  // ===========================================================================
  // Render
  // ===========================================================================

  render() {
    return html`
      <div class="toolbar">
        <button class="btn btn-primary" onclick="{handleRefresh}" title="Refresh (R)">
          ↻ Refresh
        </button>
        <button class="btn btn-secondary" onclick="{handleClear}" title="Clear all">
          ✕ Clear
        </button>
        <button class="btn btn-secondary" onclick="{handleForceGC}" title="Force garbage collection">
          ⌀ Force GC
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
          <div class="{this.graphTabClass}" onclick="{switchTabToGraph}">
            <span class="tab-icon">◈</span>
            <span class="tab-label">Graph</span>
            <span class="tab-count">{this.state.graphNodes.length}</span>
          </div>
          <div class="{this.subscriptionsTabClass}" onclick="{switchTabToSubscriptions}">
            <span class="tab-icon">⇌</span>
            <span class="tab-label">Subscriptions</span>
            <span class="tab-count">{this.state.activeSubscriptions.length}</span>
          </div>

          <div class="sidebar-footer">
            <div class="keyboard-hints">
              <span class="hint"><kbd>R</kbd> Refresh  <kbd>1-6</kbd> Tabs</span>
            </div>
          </div>
        </div>

        <div class="content">
          <${If} condition="{this.isComponentsTabActive}">
            <components-tab
              :components="{this.state.components}"
              :on-navigate-to-model="{this.navigateToModel}"
              :on-inspect="{this.handleInspectComponent}">
            </components-tab>
          </${If}>
          <${If} condition="{this.isModelsTabActive}">
            <models-tab
              :models="{this.state.models}"
              :navigate-to-id="{this.state.navigateToModelId}"
              :on-navigate-to-model="{this.navigateToModel}">
            </models-tab>
          </${If}>
          <${If} condition="{this.isEffectsTabActive}">
            <effects-tab :effects="{this.state.effects}"></effects-tab>
          </${If}>
          <${If} condition="{this.isTimelineTabActive}">
            <timeline-tab :timeline="{this.state.timeline}"></timeline-tab>
          </${If}>
          <${If} condition="{this.isGraphTabActive}">
            <graph-tab :nodes="{this.state.graphNodes}" :edges="{this.state.graphEdges}"></graph-tab>
          </${If}>
          <${If} condition="{this.isSubscriptionsTabActive}">
            <subscriptions-tab
              :active-subscriptions="{this.state.activeSubscriptions}"
              :history="{this.state.subscriptionHistory}"
              :ws-connected="{this.state.wsConnected}">
            </subscriptions-tab>
          </${If}>
        </div>
      </div>
    `;
  }
}

// Register main panel component
customElements.define(DevToolsPanel.tag, DevToolsPanel);
