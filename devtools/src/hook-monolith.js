/**
 * Veda Client DevTools Hook
 * Injected into page to track reactive state and components
 * 
 * This is the new modular version - modules are embedded via build process
 */

(function() {
  if (window.__VEDA_DEVTOOLS_HOOK__) return;

  // === Module: EventEmitter ===
  
function createEventEmitter() {
  const listeners = {};

  return {
    on(event, callback) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    },

    off(event, callback) {
      if (!listeners[event]) return;
      if (!callback) {
        delete listeners[event];
      } else {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      }
    },

    emit(event, data) {
      const eventListeners = listeners[event];
      if (eventListeners) {
        eventListeners.forEach(cb => {
          try {
            cb(data);
          } catch (e) {
            console.warn('[Veda DevTools] Listener error:', e);
          }
        });
      }

      // Send to DevTools panel via postMessage
      window.postMessage({
        source: 'veda-devtools-hook',
        event,
        data
      }, '*');
    }
  };
}



  // === Module: Timeline ===
  
function createTimeline(maxEvents = 100) {
  const timeline = [];

  return {
    timeline,

    add(event, data) {
      const entry = {
        id: Date.now() + Math.random(),
        event,
        data,
        timestamp: Date.now()
      };

      timeline.push(entry);

      if (timeline.length > maxEvents) {
        timeline.shift();
      }
    },

    get(limit = 50) {
      return timeline.slice(-limit);
    },

    clear() {
      timeline.length = 0;
    }
  };
}



  // === Module: Serializer ===
  
function createSerializer() {
  function serializeValue(value, depth = 0) {
    if (depth > 3) return '[Deep Object]';
    if (value === null) return null;
    if (value === undefined) return undefined;

    const type = typeof value;
    if (type === 'function') return '[Function]';
    if (type !== 'object') return value;

    // Check for Model-like objects
    if (value.id || value['@']) {
      return { _type: 'Model', id: value.id || value['@'] };
    }

    if (value instanceof Date) return value.toISOString();
    if (value instanceof RegExp) return value.toString();
    if (value instanceof Set) return `Set(${value.size})`;
    if (value instanceof Map) return `Map(${value.size})`;

    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      if (value.length <= 5) {
        return value.map(item => serializeValue(item, depth + 1));
      }
      return value.slice(0, 5).map(item => serializeValue(item, depth + 1))
        .concat([`... +${value.length - 5} more`]);
    }

    // Plain object
    const result = {};
    let count = 0;
    for (const key in value) {
      if (key.startsWith('_') || key.startsWith('#')) continue;
      if (count++ > 15) {
        result['...'] = `${Object.keys(value).length - 15} more`;
        break;
      }
      try {
        result[key] = serializeValue(value[key], depth + 1);
      } catch (e) {
        result[key] = '[Error]';
      }
    }
    return result;
  }

  function extractComponentState(component) {
    const state = {};

    if (!component.state) return state;

    try {
      const stateObj = component.state;

      const keys = [];
      for (const key in stateObj) {
        if (Object.prototype.hasOwnProperty.call(stateObj, key)) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        if (key.startsWith('_') || key.startsWith('#')) continue;
        if (key === '__isReactive') continue;
        if (key === 'model') continue;

        try {
          const value = stateObj[key];
          state[key] = serializeValue(value);
        } catch (e) {
          state[key] = '[Error]';
        }
      }
    } catch (e) {
      console.warn('[Veda DevTools] extractComponentState error:', e);
    }

    return state;
  }

  function getModelType(model) {
    try {
      const type = model['rdf:type'] || model['@type'];
      if (!type) return 'No type';

      if (Array.isArray(type) && type.length > 0) {
        const t = type[0];
        if (t && typeof t === 'object' && t.id) return t.id;
        if (t && typeof t === 'object') return t['@'] || t.data || String(t);
        if (typeof t === 'string') return t;
        return String(t);
      }

      if (typeof type === 'object' && type.id) return type.id;
      if (typeof type === 'object') return type['@'] || type.data || 'Unknown';
      if (typeof type === 'string') return type;

      return 'Unknown';
    } catch (e) {
      console.warn('[Veda DevTools] getModelType error:', e);
      return 'Error';
    }
  }

  function serializeModelProperties(model) {
    const props = {};

    if (!model) return props;

    try {
      for (const key in model) {
        if (key.startsWith('v-') || key.startsWith('rdf:') ||
            key.startsWith('rdfs:') || key.startsWith('@') ||
            key === 'id') {

          try {
            const value = model[key];
            if (Array.isArray(value)) {
              props[key] = value.slice(0, 10).map(v => {
                if (typeof v === 'object' && v !== null) {
                  if (v.id || v['@']) {
                    return { _type: 'Model', id: v.id || v['@'] };
                  }
                  if (v.data !== undefined) {
                    return v.data;
                  }
                }
                return serializeValue(v);
              });
              if (value.length > 10) {
                props[key].push(`... +${value.length - 10} more`);
              }
            } else {
              props[key] = serializeValue(value);
            }
          } catch (e) {
            props[key] = '[Error]';
          }
        }
      }
    } catch (e) {
      // Model may not be enumerable
    }

    return props;
  }

  return {
    serializeValue,
    extractComponentState,
    getModelType,
    serializeModelProperties
  };
}



  // === Module: Profiler ===
  
function createProfiler() {
  let profiling = false;
  const profileData = [];
  let profileStartTime = 0;

  return {
    get profiling() { return profiling; },
    get profileData() { return profileData; },

    start() {
      profiling = true;
      profileData.length = 0;
      profileStartTime = performance.now();
      console.log('[Veda DevTools] Profiling started');
    },

    stop() {
      profiling = false;
      const duration = performance.now() - profileStartTime;
      console.log('[Veda DevTools] Profiling stopped, duration:', duration, 'ms');
      return {
        duration,
        events: profileData.slice(),
        summary: getSummary()
      };
    },

    record(type, data) {
      if (!profiling) return;
      profileData.push({
        type,
        data,
        timestamp: performance.now() - profileStartTime
      });
    }
  };

  function getSummary() {
    const summary = {
      renders: 0,
      totalRenderTime: 0,
      effectTriggers: 0,
      modelUpdates: 0,
      componentsByRenders: {}
    };

    for (const event of profileData) {
      if (event.type === 'render') {
        summary.renders++;
        summary.totalRenderTime += event.data.time || 0;
        const tag = event.data.tagName || 'unknown';
        summary.componentsByRenders[tag] = (summary.componentsByRenders[tag] || 0) + 1;
      } else if (event.type === 'effect') {
        summary.effectTriggers++;
      } else if (event.type === 'model-update') {
        summary.modelUpdates++;
      }
    }

    return summary;
  }
}



  // === Module: ComponentTracker ===
  
function createComponentTracker(emit, addToTimeline, extractState) {
  const components = new Map();
  const componentToId = new WeakMap();
  let componentCounter = 0;

  const registry = new FinalizationRegistry((id) => {
    components.delete(id);
    addToTimeline('component:removed', { id });
    emit('component:removed', { id });
  });

  function findParentComponentId(component) {
    let el = component.parentElement;
    while (el) {
      const parentId = componentToId.get(el);
      if (parentId) return parentId;
      el = el.parentElement;
    }
    return null;
  }

  function getComponentModelId(component) {
    try {
      if (component.state?.model?.id) return component.state.model.id;
      if (component.state?.model?.['@']) return component.state.model['@'];
      if (component.model?.id) return component.model.id;
      if (component.model?.['@']) return component.model['@'];
      return null;
    } catch (e) {
      return null;
    }
  }

  return {
    components,
    componentToId,

    track(component) {
      const existingId = componentToId.get(component);
      if (existingId) return existingId;

      const id = ++componentCounter;
      const parentId = findParentComponentId(component);
      const data = {
        id,
        componentRef: new WeakRef(component),
        tagName: component.tagName?.toLowerCase() || 'unknown',
        modelId: getComponentModelId(component),
        parentId,
        childIds: [],
        createdAt: Date.now(),
        renderCount: 0
      };

      components.set(id, data);
      componentToId.set(component, id);
      registry.register(component, id);

      if (parentId) {
        const parentData = components.get(parentId);
        if (parentData && !parentData.childIds.includes(id)) {
          parentData.childIds.push(id);
        }
      }

      addToTimeline('component:created', {
        id,
        tagName: data.tagName,
        modelId: data.modelId
      });

      emit('component:created', {
        id,
        tagName: data.tagName,
        modelId: data.modelId,
        parentId,
        state: extractState(component),
        createdAt: data.createdAt,
        renderCount: 0
      });

      return id;
    },

    untrack(component) {
      const id = componentToId.get(component);
      if (!id) return;

      const data = components.get(id);
      const tagName = data?.tagName || 'unknown';

      if (data?.parentId) {
        const parentData = components.get(data.parentId);
        if (parentData) {
          parentData.childIds = parentData.childIds.filter(cid => cid !== id);
        }
      }

      components.delete(id);
      componentToId.delete(component);

      addToTimeline('component:removed', { id, tagName });
      emit('component:removed', { id, tagName });
    },

    trackStateChange(component) {
      const id = componentToId.get(component);
      if (!id) return;

      const data = components.get(id);
      if (!data) return;

      const newModelId = getComponentModelId(component);
      if (newModelId !== data.modelId) {
        data.modelId = newModelId;
      }

      const newState = extractState(component);

      addToTimeline('component:state-changed', {
        id,
        tagName: data.tagName
      });

      emit('component:state-changed', {
        id,
        state: newState,
        modelId: data.modelId
      });
    },

    trackRender(component, startTime, recordProfileEvent) {
      const id = componentToId.get(component);
      if (!id) return;

      const data = components.get(id);
      if (!data) return;

      data.renderCount++;

      const renderTime = startTime ? (performance.now() - startTime) : 0;

      recordProfileEvent('render', {
        tagName: data.tagName,
        id,
        time: renderTime
      });

      if (!data.renderTimes) {
        data.renderTimes = [];
        data.totalRenderTime = 0;
        data.maxRenderTime = 0;
        data.avgRenderTime = 0;
      }

      data.renderTimes.push(renderTime);
      data.totalRenderTime += renderTime;
      data.maxRenderTime = Math.max(data.maxRenderTime, renderTime);

      if (data.renderTimes.length > 100) {
        const removed = data.renderTimes.shift();
        data.totalRenderTime -= removed;
      }

      data.avgRenderTime = data.totalRenderTime / data.renderTimes.length;
      data.lastRenderTime = renderTime;

      if (!data.renderWindow) {
        data.renderWindow = [];
      }
      data.renderWindow.push(Date.now());

      const cutoff = Date.now() - 5000;
      data.renderWindow = data.renderWindow.filter(t => t > cutoff);
      data.rendersPerSecond = data.renderWindow.length / 5;
    },

    getPerformanceStats() {
      const stats = [];
      for (const [id, data] of components.entries()) {
        const component = data.componentRef.deref();
        if (!component) continue;

        stats.push({
          id,
          tagName: data.tagName,
          renderCount: data.renderCount || 0,
          totalRenderTime: data.totalRenderTime || 0,
          avgRenderTime: data.avgRenderTime || 0,
          maxRenderTime: data.maxRenderTime || 0,
          lastRenderTime: data.lastRenderTime || 0,
          rendersPerSecond: data.rendersPerSecond || 0
        });
      }

      return stats.sort((a, b) => b.totalRenderTime - a.totalRenderTime);
    }
  };
}



  // === Module: ModelTracker ===
  
function createModelTracker(emit, addToTimeline, serializeProperties, getModelType) {
  const models = new Map();
  const modelToId = new WeakMap();
  let modelCounter = 0;

  const registry = new FinalizationRegistry((id) => {
    models.delete(id);
    addToTimeline('model:removed', { id });
    emit('model:removed', { id });
  });

  return {
    models,
    modelToId,

    track(model) {
      const modelId = model.id || model['@'];
      if (!modelId) return;

      const existing = modelToId.get(model);
      if (existing) return existing;

      // Check by modelId (different instance, same model)
      for (const [id, data] of models.entries()) {
        if (data.modelId === modelId) {
          modelToId.set(model, id);
          return id;
        }
      }

      const id = ++modelCounter;
      const isLoaded = typeof model.isLoaded === 'function' ? model.isLoaded() : false;
      const data = {
        id,
        modelRef: new WeakRef(model),
        modelId,
        type: getModelType(model),
        isLoaded,
        properties: serializeProperties(model),
        createdAt: Date.now(),
        updateCount: 0
      };

      models.set(id, data);
      modelToId.set(model, id);
      registry.register(model, id);

      addToTimeline('model:created', {
        id,
        modelId,
        type: data.type
      });

      emit('model:created', {
        id,
        modelId,
        type: data.type,
        isLoaded: data.isLoaded,
        properties: data.properties,
        createdAt: data.createdAt,
        updateCount: 0
      });

      return id;
    },

    trackUpdate(model, recordProfileEvent) {
      const id = modelToId.get(model);
      if (!id) return;

      const data = models.get(id);
      if (!data) return;

      data.updateCount++;
      data.properties = serializeProperties(model);

      recordProfileEvent('model-update', { id, type: data.type });

      const isLoaded = typeof model.isLoaded === 'function' ? model.isLoaded() : false;
      data.isLoaded = isLoaded;

      const newType = getModelType(model);
      if (newType !== 'No type' && newType !== 'Unknown' && newType !== 'Error') {
        data.type = newType;
      }

      addToTimeline('model:updated', {
        id,
        modelId: data.modelId,
        type: data.type
      });

      emit('model:updated', {
        id,
        modelId: data.modelId,
        type: data.type,
        isLoaded: data.isLoaded,
        properties: data.properties,
        updateCount: data.updateCount
      });
    },

    findByModelId(modelId) {
      for (const data of models.values()) {
        if (data.modelId === modelId) {
          return data;
        }
      }
      return null;
    }
  };
}



  // === Module: EffectTracker ===
  
function createEffectTracker(emit, addToTimeline, componentToId) {
  const effects = new Map();
  const effectToId = new WeakMap();
  let effectCounter = 0;

  const registry = new FinalizationRegistry((id) => {
    effects.delete(id);
    addToTimeline('effect:removed', { id });
    emit('effect:removed', { id });
  });

  function getEffectInfo(effect) {
    try {
      if (effect.options?.name && effect.options.name.length > 2) {
        return effect.options.name;
      }

      if (effect.name && effect.name !== 'effectFn' && effect.name.length > 2) {
        return effect.name;
      }

      const str = effect.toString();

      const arrowMatch = str.match(/\(\)\s*=>\s*this\.(\w+)/);
      if (arrowMatch && arrowMatch[1].length > 2) {
        return `computed: ${arrowMatch[1]}`;
      }

      const getterMatch = str.match(/get\s+(\w+)\s*\(\)/);
      if (getterMatch && getterMatch[1].length > 2) {
        return `getter: ${getterMatch[1]}`;
      }

      const funcMatch = str.match(/function\s+(\w+)/);
      if (funcMatch && funcMatch[1] !== 'anonymous' && funcMatch[1].length > 2) {
        return funcMatch[1];
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }

  return {
    effects,
    effectToId,

    track(effect) {
      const existingId = effectToId.get(effect);
      if (existingId) return existingId;

      const id = ++effectCounter;
      const effectName = getEffectInfo(effect);

      let componentTag = null;
      let componentId = null;
      const comp = effect.options?.component;
      if (comp) {
        if (comp.tagName) {
          componentTag = comp.tagName.toLowerCase();
        } else if (comp.constructor?.name && comp.constructor.name !== 'Object') {
          componentTag = comp.constructor.name;
        }
        componentId = componentToId.get(comp) || null;
      }

      const data = {
        id,
        effectRef: new WeakRef(effect),
        triggerCount: 0,
        lastTriggered: null,
        createdAt: Date.now(),
        name: effectName,
        componentTag,
        componentId,
        dependencies: [],
        isComputed: effect.options?.computed || false,
        isLazy: effect.options?.lazy || false
      };

      effects.set(id, data);
      effectToId.set(effect, id);
      registry.register(effect, id);

      addToTimeline('effect:created', { id });

      emit('effect:created', {
        id,
        createdAt: data.createdAt,
        triggerCount: 0,
        name: data.name,
        componentTag: data.componentTag
      });

      return id;
    },

    trackDependency(effect, target, key) {
      try {
        const effectId = effectToId.get(effect);
        if (!effectId) return;

        const data = effects.get(effectId);
        if (!data) return;

        const keyStr = String(key);

        // Filter out noise
        if (keyStr === 'constructor' ||
            keyStr === 'length' ||
            keyStr === '__isReactive' ||
            keyStr === 'then' ||
            keyStr === 'toJSON' ||
            /^\d+$/.test(keyStr) ||
            typeof key === 'symbol') {
          return;
        }

        let targetId = '';
        try {
          if (target && typeof target.id === 'string') {
            targetId = target.id;
          }
        } catch (e) {
          // Ignore
        }

        const depKey = `${targetId}:${keyStr}`;
        if (!data.dependencies.some(d => d.key === depKey)) {
          data.dependencies.push({
            key: depKey,
            targetId,
            property: keyStr
          });
        }
      } catch (e) {
        // Silently fail
      }
    },

    trackTrigger(effect, recordProfileEvent) {
      const id = effectToId.get(effect);
      if (!id) return;

      const data = effects.get(id);
      if (!data) return;

      data.triggerCount++;
      data.lastTriggered = Date.now();

      recordProfileEvent('effect', { id, triggerCount: data.triggerCount });

      if (data.triggerCount <= 10 || data.triggerCount % 5 === 0) {
        emit('effect:triggered', {
          id,
          triggerCount: data.triggerCount,
          lastTriggered: data.lastTriggered
        });
      }

      if (data.triggerCount <= 3 || data.triggerCount % 10 === 0) {
        addToTimeline('effect:triggered', {
          id,
          triggerCount: data.triggerCount
        });
      }
    },

    untrack(effect) {
      const id = effectToId.get(effect);
      if (!id) return;

      effects.delete(id);
      effectToId.delete(effect);

      addToTimeline('effect:removed', { id });
      emit('effect:removed', { id });
    }
  };
}



  // === Module: SubscriptionTracker ===
  
function createSubscriptionTracker(emit) {
  const subscriptions = new Map();
  const subscriptionHistory = [];
  const maxSubscriptionHistory = 200;

  return {
    subscriptions,
    subscriptionHistory,

    track(id, updateCounter) {
      const now = Date.now();
      if (!subscriptions.has(id)) {
        subscriptions.set(id, {
          id,
          subscribedAt: now,
          updateCounter,
          updateCount: 0,
          lastUpdate: null
        });

        subscriptionHistory.push({
          type: 'subscribe',
          id,
          timestamp: now,
          updateCounter
        });

        if (subscriptionHistory.length > maxSubscriptionHistory) {
          subscriptionHistory.shift();
        }

        emit('subscription:added', { id, updateCounter, timestamp: now });
      }
    },

    trackUnsubscription(id) {
      const now = Date.now();
      if (subscriptions.has(id)) {
        const data = subscriptions.get(id);
        subscriptions.delete(id);

        subscriptionHistory.push({
          type: 'unsubscribe',
          id,
          timestamp: now,
          duration: now - data.subscribedAt
        });

        if (subscriptionHistory.length > maxSubscriptionHistory) {
          subscriptionHistory.shift();
        }

        emit('subscription:removed', { id, timestamp: now });
      }
    },

    trackUpdate(id, updateCounter) {
      const data = subscriptions.get(id);
      if (data) {
        data.updateCount++;
        data.lastUpdate = Date.now();
        data.updateCounter = updateCounter;
      }
    },

    getStats(wsConnected) {
      return {
        active: Array.from(subscriptions.values()),
        history: subscriptionHistory.slice(-100),
        totalSubscriptions: subscriptions.size,
        wsConnected: wsConnected || false
      };
    }
  };
}



  // === Module: Inspector ===
  
function createInspector(components) {
  let highlightOverlay = null;
  let highlightedComponent = null;
  let scrollHandler = null;
  let mutationObserver = null;

  function createHighlightOverlay() {
    if (highlightOverlay) return highlightOverlay;

    highlightOverlay = document.createElement('div');
    highlightOverlay.id = '__veda_devtools_highlight__';
    highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid #0e639c;
      background: rgba(14, 99, 156, 0.1);
      display: none;
    `;

    const label = document.createElement('div');
    label.className = '__veda_devtools_label__';
    label.style.cssText = `
      position: absolute;
      top: -24px;
      left: -2px;
      background: #0e639c;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 2px 2px 0 0;
      white-space: nowrap;
    `;
    highlightOverlay.appendChild(label);

    document.body.appendChild(highlightOverlay);
    return highlightOverlay;
  }

  function updateHighlightPosition() {
    if (!highlightedComponent || !highlightOverlay) return;

    if (!document.body.contains(highlightedComponent)) {
      hideHighlight();
      return;
    }

    const rect = highlightedComponent.getBoundingClientRect();
    highlightOverlay.style.top = rect.top + 'px';
    highlightOverlay.style.left = rect.left + 'px';
    highlightOverlay.style.width = rect.width + 'px';
    highlightOverlay.style.height = rect.height + 'px';
  }

  function highlightElement(componentId) {
    const data = components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    highlightedComponent = component;
    const overlay = createHighlightOverlay();
    const label = overlay.querySelector('.__veda_devtools_label__');

    updateHighlightPosition();
    overlay.style.display = 'block';
    label.textContent = `<${data.tagName}>`;

    if (!scrollHandler) {
      scrollHandler = () => updateHighlightPosition();
      window.addEventListener('scroll', scrollHandler, true);
      window.addEventListener('resize', scrollHandler);
    }

    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    mutationObserver = new MutationObserver(() => {
      if (highlightedComponent && !document.body.contains(highlightedComponent)) {
        hideHighlight();
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return true;
  }

  function hideHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
    highlightedComponent = null;
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  function inspectElement(componentId) {
    const data = components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    window.$v = component;

    if (!window.__veda_inspect_history__) {
      window.__veda_inspect_history__ = [];
    }

    const history = window.__veda_inspect_history__;
    history.unshift(component);
    if (history.length > 5) history.pop();

    history.forEach((el, i) => {
      window['$v' + i] = el;
    });

    console.log(
      '%c[Veda DevTools]%c Selected component stored in %c$v%c',
      'color: #0e639c; font-weight: bold;',
      'color: inherit;',
      'color: #4ec9b0; font-weight: bold;',
      'color: inherit;'
    );

    return true;
  }

  function scrollToElement(componentId) {
    const data = components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    component.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }

  function setComponentState(componentId, key, value) {
    const data = components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component || !component.state) return false;

    try {
      component.state[key] = value;
      return true;
    } catch (e) {
      console.warn('[Veda DevTools] Failed to set state:', e);
      return false;
    }
  }

  return {
    highlightElement,
    hideHighlight,
    inspectElement,
    scrollToElement,
    setComponentState
  };
}



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

