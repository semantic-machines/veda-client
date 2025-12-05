/**
 * Veda Client DevTools Hook
 * Injected into page to track reactive state and components
 * 
 * This is the new modular version - modules are embedded via build process
 */

(function() {
  if (window.__VEDA_DEVTOOLS_HOOK__) return;

  // === Module: EventEmitter ===
  ${EventEmitter}

  // === Module: Timeline ===
  ${Timeline}

  // === Module: Serializer ===
  ${Serializer}

  // === Module: Profiler ===
  ${Profiler}

  // === Module: ComponentTracker ===
  ${ComponentTracker}

  // === Module: ModelTracker ===
  ${ModelTracker}

  // === Module: EffectTracker ===
  ${EffectTracker}

  // === Module: SubscriptionTracker ===
  ${SubscriptionTracker}

  // === Module: Inspector ===
  ${Inspector}

  // === Main Hook ===

  // Create event emitter
  const emitter = createEventEmitter();
  
  // Create timeline
  const timeline = createTimeline(100);
  
  // Create serializer
  const serializer = createSerializer();
  
  // Create profiler
  const profiler = createProfiler();
  
  // Create component tracker
  const componentTracker = createComponentTracker(
    emitter.emit,
    timeline.add,
    serializer.extractComponentState
  );
  
  // Create model tracker
  const modelTracker = createModelTracker(
    emitter.emit,
    timeline.add,
    serializer.serializeModelProperties,
    serializer.getModelType
  );
  
  // Create effect tracker
  const effectTracker = createEffectTracker(
    emitter.emit,
    timeline.add,
    componentTracker.componentToId
  );
  
  // Create subscription tracker
  const subscriptionTracker = createSubscriptionTracker(emitter.emit);
  
  // Create inspector
  const inspector = createInspector(componentTracker.components);

  // Create main hook object
  const hook = {
    // Component tracking
    trackComponent: componentTracker.track.bind(componentTracker),
    untrackComponent: componentTracker.untrack.bind(componentTracker),
    trackComponentStateChange: componentTracker.trackStateChange.bind(componentTracker),
    trackComponentRender: (comp, startTime) => 
      componentTracker.trackRender(comp, startTime, profiler.record.bind(profiler)),
    
    // Model tracking
    trackModel: modelTracker.track.bind(modelTracker),
    trackModelUpdate: (model) => 
      modelTracker.trackUpdate(model, profiler.record.bind(profiler)),
    
    // Effect tracking
    trackEffect: effectTracker.track.bind(effectTracker),
    trackEffectDependency: effectTracker.trackDependency.bind(effectTracker),
    trackEffectTrigger: (effect) => 
      effectTracker.trackTrigger(effect, profiler.record.bind(profiler)),
    untrackEffect: effectTracker.untrack.bind(effectTracker),
    
    // Subscription tracking
    trackSubscription: subscriptionTracker.track.bind(subscriptionTracker),
    trackUnsubscription: subscriptionTracker.trackUnsubscription.bind(subscriptionTracker),
    trackSubscriptionUpdate: subscriptionTracker.trackUpdate.bind(subscriptionTracker),
    
    // Timeline
    addToTimeline: timeline.add.bind(timeline),
    
    // Event emitter
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),
    
    // Profiling
    get profiling() { return profiler.profiling; },
    startProfiling: profiler.start.bind(profiler),
    stopProfiling: profiler.stop.bind(profiler),
    getPerformanceStats: componentTracker.getPerformanceStats.bind(componentTracker),
    
    // Inspection
    highlightElement: inspector.highlightElement.bind(inspector),
    hideHighlight: inspector.hideHighlight.bind(inspector),
    inspectElement: inspector.inspectElement.bind(inspector),
    scrollToElement: inspector.scrollToElement.bind(inspector),
    setComponentState: inspector.setComponentState.bind(inspector),
    
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

  // === Message Handler ===
  
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

  // === Subscription Interceptor ===
  
  function interceptSubscription() {
    const checkInterval = setInterval(() => {
      let Subscription = null;

      if (window.Subscription) {
        Subscription = window.Subscription;
      }

      if (!Subscription && window.__VEDA_SUBSCRIPTION__) {
        Subscription = window.__VEDA_SUBSCRIPTION__;
      }

      if (Subscription && Subscription.subscribe && !Subscription._devtoolsIntercepted) {
        Subscription._devtoolsIntercepted = true;

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

        if (Subscription._socket) {
          hook.wsConnected = Subscription._socket.readyState === 1;
          hook.wsAddress = Subscription._address;
        }

        if (Subscription._subscriptions && Subscription._subscriptions.size > 0) {
          for (const [id, subscription] of Subscription._subscriptions.entries()) {
            const updateCounter = subscription[1] || 0;
            hook.trackSubscription(id, updateCounter);
          }
          console.log('[Veda DevTools] Synced', Subscription._subscriptions.size, 'existing subscriptions');
        }

        const originalReceive = Subscription._receive;
        if (originalReceive) {
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

        const originalConnect = Subscription._connect?.bind(Subscription);
        if (originalConnect) {
          Subscription._connect = async function(event) {
            const result = await originalConnect(event);
            setTimeout(() => {
              hook.wsConnected = Subscription._socket?.readyState === 1;
              hook.wsAddress = Subscription._address;
              hook.emit('ws:state-changed', {
                connected: hook.wsConnected,
                address: hook.wsAddress
              });
            }, 100);
            return result;
          };
        }

        console.log('[Veda DevTools] Subscription tracking enabled');
        clearInterval(checkInterval);
      }
    }, 500);

    setTimeout(() => clearInterval(checkInterval), 30000);
  }

  interceptSubscription();
})();

