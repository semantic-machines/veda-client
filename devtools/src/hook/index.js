/**
 * Veda Client DevTools Hook - Entry Point
 * Injected into page to track reactive state and components
 */

import { EventEmitter } from './modules/EventEmitter.js';
import { Timeline } from './modules/Timeline.js';
import { Serializer } from './modules/Serializer.js';
import { Profiler } from './modules/Profiler.js';
import { ComponentTracker } from './modules/ComponentTracker.js';
import { ModelTracker } from './modules/ModelTracker.js';
import { EffectTracker } from './modules/EffectTracker.js';
import { SubscriptionTracker } from './modules/SubscriptionTracker.js';
import { Inspector } from './modules/Inspector.js';
import { DEVTOOLS_CONFIG } from '../config.js';

(function() {
  if (window.__VEDA_DEVTOOLS_HOOK__) return;

  // Create core modules
  const emitter = new EventEmitter();
  const timeline = new Timeline(100);
  const serializer = new Serializer();
  const profiler = new Profiler();

  // Pre-bind frequently used methods
  const emit = emitter.emit.bind(emitter);
  const addToTimeline = timeline.add.bind(timeline);
  const extractComponentState = serializer.extractComponentState.bind(serializer);
  const serializeModelProperties = serializer.serializeModelProperties.bind(serializer);
  const getModelType = serializer.getModelType.bind(serializer);
  const recordProfile = profiler.record.bind(profiler);

  // Create trackers
  const componentTracker = new ComponentTracker(
    emit,
    addToTimeline,
    extractComponentState
  );

  const modelTracker = new ModelTracker(
    emit,
    addToTimeline,
    serializeModelProperties,
    getModelType
  );

  const effectTracker = new EffectTracker(
    emit,
    addToTimeline,
    componentTracker.componentToId
  );

  const subscriptionTracker = new SubscriptionTracker(emit);

  const inspector = new Inspector(componentTracker.components);

  // Create main hook object
  const hook = {
    // Component tracking
    trackComponent: (comp) => componentTracker.track(comp),
    untrackComponent: (comp) => componentTracker.untrack(comp),
    trackComponentStateChange: (comp) => componentTracker.trackStateChange(comp),
    trackComponentRender: (comp, startTime) =>
      componentTracker.trackRender(comp, startTime, recordProfile),

    // Model tracking
    trackModel: (model) => modelTracker.track(model),
    trackModelUpdate: (model) =>
      modelTracker.trackUpdate(model, recordProfile),

    // Effect tracking
    trackEffect: (effect) => effectTracker.track(effect),
    trackEffectDependency: (effect, target, key) => effectTracker.trackDependency(effect, target, key),
    trackEffectTrigger: (effect) =>
      effectTracker.trackTrigger(effect, recordProfile),
    untrackEffect: (effect) => effectTracker.untrack(effect),

    // Subscription tracking
    trackSubscription: (id, updateCounter) => subscriptionTracker.track(id, updateCounter),
    trackUnsubscription: (id) => subscriptionTracker.trackUnsubscription(id),
    trackSubscriptionUpdate: (id, updateCounter) => subscriptionTracker.trackUpdate(id, updateCounter),

    // Timeline
    addToTimeline: (event, data) => timeline.add(event, data),

    // Event emitter
    on: (event, cb) => emitter.on(event, cb),
    off: (event, cb) => emitter.off(event, cb),
    emit: (event, data) => emitter.emit(event, data),

    // Profiling
    get profiling() { return profiler.profiling; },
    startProfiling: () => profiler.start(),
    stopProfiling: () => profiler.stop(),
    getPerformanceStats: () => componentTracker.getPerformanceStats(),

    // Inspection
    highlightElement: (id) => inspector.highlightElement(id),
    hideHighlight: () => inspector.hideHighlight(),
    inspectElement: (id) => inspector.inspectElement(id),
    scrollToElement: (id) => inspector.scrollToElement(id),
    setComponentState: (id, key, value) => inspector.setComponentState(id, key, value),

    // WebSocket state
    wsConnected: false,
    wsAddress: null,

    // Snapshot
    getSnapshot() {
      const validComponents = [];
      const validIds = new Set();

      for (const c of componentTracker.components.values()) {
        const component = c.componentRef.deref();
        if (component) {
          validIds.add(c.id);
          validComponents.push(c);
        }
      }

      return {
        components: validComponents.map(c => {
          const component = c.componentRef.deref();
          const childIds = (c.childIds || []).filter(id => validIds.has(id));
          return {
            id: c.id,
            tagName: c.tagName,
            modelId: c.modelId,
            parentId: validIds.has(c.parentId) ? c.parentId : null,
            childIds,
            state: serializer.extractComponentState(component),
            renderCount: c.renderCount,
            createdAt: c.createdAt,
            avgRenderTime: c.avgRenderTime || 0,
            maxRenderTime: c.maxRenderTime || 0,
            lastRenderTime: c.lastRenderTime || 0,
            totalRenderTime: c.totalRenderTime || 0,
            rendersPerSecond: c.rendersPerSecond || 0
          };
        }),
        models: Array.from(modelTracker.models.values())
          .map(m => {
            const model = m.modelRef.deref();
            if (!model) return null;
            return {
              id: m.id,
              modelId: m.modelId,
              type: m.type,
              isLoaded: typeof model.isLoaded === 'function' ? model.isLoaded() : m.isLoaded,
              properties: serializer.serializeModelProperties(model),
              updateCount: m.updateCount,
              createdAt: m.createdAt
            };
          })
          .filter(Boolean),
        effects: Array.from(effectTracker.effects.values())
          .map(e => {
            const effect = e.effectRef.deref();
            if (!effect) return null;
            return {
              id: e.id,
              triggerCount: e.triggerCount,
              lastTriggered: e.lastTriggered,
              createdAt: e.createdAt,
              name: e.name,
              componentTag: e.componentTag,
              componentId: e.componentId,
              modelId: e.modelId,
              dependencies: e.dependencies || [],
              depsCount: (e.dependencies || []).length,
              isComputed: e.isComputed || false,
              isLazy: e.isLazy || false
            };
          })
          .filter(Boolean),
        timeline: timeline.get(50),
        performance: {
          stats: componentTracker.getPerformanceStats(),
          profiling: profiler.profiling
        },
        subscriptions: subscriptionTracker.getStats(hook.wsConnected)
      };
    }
  };

  // Make hook globally available
  window.__VEDA_DEVTOOLS_HOOK__ = hook;

  // Message handler
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data.source !== 'veda-devtools-request') return;

    const { type, componentId, key, value } = event.data;

    if (type === 'get-snapshot') {
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'snapshot',
        data: hook.getSnapshot()
      }, '*');
    }

    if (type === 'highlight-element') {
      const result = hook.highlightElement(componentId);
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'highlight-result',
        success: result
      }, '*');
    }

    if (type === 'hide-highlight') {
      hook.hideHighlight();
    }

    if (type === 'inspect-element') {
      const result = hook.inspectElement(componentId);
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'inspect-result',
        success: result
      }, '*');
    }

    if (type === 'scroll-to-element') {
      const result = hook.scrollToElement(componentId);
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'scroll-result',
        success: result
      }, '*');
    }

    if (type === 'set-component-state') {
      const result = hook.setComponentState(componentId, key, value);
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'set-state-result',
        success: result
      }, '*');
    }

    if (type === 'start-profiling') {
      hook.startProfiling();
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'profiling-started'
      }, '*');
    }

    if (type === 'stop-profiling') {
      const result = hook.stopProfiling();
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'profiling-result',
        data: result
      }, '*');
    }

    if (type === 'get-performance') {
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'performance-stats',
        data: hook.getPerformanceStats()
      }, '*');
    }
  });

  // Notify that hook is ready
  window.postMessage({
    source: 'veda-devtools-hook',
    event: 'hook:ready',
    data: {}
  }, '*');

  // Subscription interceptor
  function findSubscriptionObject() {
    return window.Subscription || window.__VEDA_SUBSCRIPTION__ || null;
  }

  function interceptSubscriptionMethods(Subscription) {
    const originalSubscribe = Subscription.subscribe.bind(Subscription);
    const originalUnsubscribe = Subscription.unsubscribe.bind(Subscription);

    Subscription.subscribe = function(ref, subscription) {
      const [id, updateCounter] = subscription;
      hook.trackSubscription(id, updateCounter);
      return originalSubscribe(ref, subscription);
    };

    Subscription.unsubscribe = function(id) {
      hook.trackUnsubscription(id);
      return originalUnsubscribe(id);
    };
  }

  function syncExistingSubscriptions(Subscription) {
    if (Subscription._subscriptions && Subscription._subscriptions.size > 0) {
      for (const [id, subscription] of Subscription._subscriptions.entries()) {
        const updateCounter = subscription[1] || 0;
        hook.trackSubscription(id, updateCounter);
      }
      console.log('[Veda DevTools] Synced', Subscription._subscriptions.size, 'existing subscriptions');
    }
  }

  function interceptReceive(Subscription) {
    const originalReceive = Subscription._receive;
    if (!originalReceive) return;

    Subscription._receive = function(event) {
      const msg = event.data;
      if (msg && msg !== '') {
        const ids = (msg.indexOf('=') === 0 ? msg.substr(1) : msg).split(',');
        for (const pairStr of ids) {
          const pair = pairStr.split('=');
          const [id, updateCounter] = pair;
          if (id && Subscription._subscriptions.has(id)) {
            hook.trackSubscriptionUpdate(id, Number(updateCounter));
          }
        }
      }
      return originalReceive.call(Subscription, event);
    };

    if (Subscription._socket) {
      Subscription._socket.onmessage = Subscription._receive;
    }
  }

  function interceptConnect(Subscription) {
    const originalConnect = Subscription._connect?.bind(Subscription);
    if (!originalConnect) return;

    Subscription._connect = async function(event) {
      const result = await originalConnect(event);
      setTimeout(() => {
        hook.wsConnected = Subscription._socket?.readyState === 1;
        hook.wsAddress = Subscription._address;
        hook.emit('ws:state-changed', {
          connected: hook.wsConnected,
          address: hook.wsAddress
        });
      }, DEVTOOLS_CONFIG.WS_STATE_CHECK_DELAY_MS);
      return result;
    };
  }

  function setupSubscriptionInterception(Subscription) {
    if (Subscription._devtoolsIntercepted) return;
    Subscription._devtoolsIntercepted = true;

    // Intercept subscription methods
    interceptSubscriptionMethods(Subscription);

    // Update WS state
    if (Subscription._socket) {
      hook.wsConnected = Subscription._socket.readyState === 1;
      hook.wsAddress = Subscription._address;
    }

    // Sync existing subscriptions
    syncExistingSubscriptions(Subscription);

    // Intercept message receive
    interceptReceive(Subscription);

    // Intercept connect for state updates
    interceptConnect(Subscription);

    console.log('[Veda DevTools] Subscription tracking enabled');
  }

  function interceptSubscription() {
    const checkInterval = setInterval(() => {
      const Subscription = findSubscriptionObject();

      if (Subscription && Subscription.subscribe) {
        setupSubscriptionInterception(Subscription);
        clearInterval(checkInterval);
      }
    }, DEVTOOLS_CONFIG.SUBSCRIPTION_CHECK_INTERVAL_MS);

    // Stop checking after timeout
    setTimeout(() => clearInterval(checkInterval), DEVTOOLS_CONFIG.SUBSCRIPTION_CHECK_TIMEOUT_MS);
  }

  interceptSubscription();
})();

