/**
 * Veda Client DevTools Hook
 * Injected into page to track reactive state and components
 */

(function() {
  if (window.__VEDA_DEVTOOLS_HOOK__) return;

  // FinalizationRegistry to clean up when objects are GC'd
  const componentRegistry = new FinalizationRegistry((id) => {
    hook.components.delete(id);
    hook.addToTimeline('component:removed', { id });
    hook.emit('component:removed', { id });
  });

  const modelRegistry = new FinalizationRegistry((id) => {
    hook.models.delete(id);
    hook.addToTimeline('model:removed', { id });
    hook.emit('model:removed', { id });
  });

  const effectRegistry = new FinalizationRegistry((id) => {
    hook.effects.delete(id);
    // Note: effectToId is WeakMap with effectFn as key, can't delete by id
    // It will be automatically cleaned up when effectFn is GC'd
    hook.addToTimeline('effect:removed', { id });
    hook.emit('effect:removed', { id });
  });

  const hook = {
    // Registries
    components: new Map(),
    componentCounter: 0,
    componentToId: new WeakMap(),
    models: new Map(),
    modelCounter: 0,
    modelToId: new WeakMap(),
    effects: new Map(),
    effectCounter: 0,
    effectToId: new WeakMap(),

    // Timeline of events
    timeline: [],
    maxTimelineEvents: 100,

    // ========================================================================
    // Component Tracking
    // ========================================================================

    trackComponent(component) {
      // Check if already tracked
      const existingId = this.componentToId.get(component);
      if (existingId) {
        return existingId;
      }

      const id = ++this.componentCounter;
      const parentId = this.findParentComponentId(component);
      const data = {
        id,
        componentRef: new WeakRef(component),  // WeakRef allows GC
        tagName: component.tagName?.toLowerCase() || 'unknown',
        modelId: this.getComponentModelId(component),
        parentId,
        childIds: [],
        createdAt: Date.now(),
        renderCount: 0
      };
      this.components.set(id, data);
      this.componentToId.set(component, id);
      componentRegistry.register(component, id);  // Auto-cleanup on GC

      // Register as child of parent
      if (parentId) {
        const parentData = this.components.get(parentId);
        if (parentData && !parentData.childIds.includes(id)) {
          parentData.childIds.push(id);
        }
      }

      this.addToTimeline('component:created', {
        id,
        tagName: data.tagName,
        modelId: data.modelId
      });

      this.emit('component:created', {
        id,
        tagName: data.tagName,
        modelId: data.modelId,
        parentId,
        state: this.extractComponentState(component),
        createdAt: data.createdAt,
        renderCount: 0
      });

      return id;
    },

    findParentComponentId(component) {
      let el = component.parentElement;
      while (el) {
        const parentId = this.componentToId.get(el);
        if (parentId) {
          return parentId;
        }
        el = el.parentElement;
      }
      return null;
    },

    getComponentModelId(component) {
      try {
        if (component.state?.model?.id) return component.state.model.id;
        if (component.state?.model?.['@']) return component.state.model['@'];
        if (component.model?.id) return component.model.id;
        if (component.model?.['@']) return component.model['@'];
        return null;
      } catch (e) {
        return null;
      }
    },

    untrackComponent(component) {
      const id = this.componentToId.get(component);
      if (!id) return;

      const data = this.components.get(id);
      const tagName = data?.tagName || 'unknown';

      // Remove from parent's childIds
      if (data?.parentId) {
        const parentData = this.components.get(data.parentId);
        if (parentData) {
          parentData.childIds = parentData.childIds.filter(cid => cid !== id);
        }
      }

      this.components.delete(id);
      this.componentToId.delete(component);

      this.addToTimeline('component:removed', { id, tagName });
      this.emit('component:removed', { id, tagName });
    },

    trackComponentStateChange(component) {
      const id = this.componentToId.get(component);
      if (!id) return;

      const data = this.components.get(id);
      if (!data) return;

      // Update model ID if it changed
      const newModelId = this.getComponentModelId(component);
      if (newModelId !== data.modelId) {
        data.modelId = newModelId;
      }

      const newState = this.extractComponentState(component);

      this.addToTimeline('component:state-changed', {
        id,
        tagName: data.tagName
      });

      this.emit('component:state-changed', {
        id,
        state: newState,
        modelId: data.modelId
      });
    },

    trackComponentRender(component, startTime) {
      const id = this.componentToId.get(component);
      if (!id) return;

      const data = this.components.get(id);
      if (data) {
        data.renderCount++;

        // Track render time
        const renderTime = startTime ? (performance.now() - startTime) : 0;

        // Record for profiling
        this.recordProfileEvent('render', {
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

        // Keep only last 100 render times
        if (data.renderTimes.length > 100) {
          const removed = data.renderTimes.shift();
          data.totalRenderTime -= removed;
        }

        data.avgRenderTime = data.totalRenderTime / data.renderTimes.length;
        data.lastRenderTime = renderTime;

        // Track if this is a "hot" component (frequent renders)
        if (!data.renderWindow) {
          data.renderWindow = [];
        }
        data.renderWindow.push(Date.now());

        // Keep only renders in last 5 seconds
        const cutoff = Date.now() - 5000;
        data.renderWindow = data.renderWindow.filter(t => t > cutoff);
        data.rendersPerSecond = data.renderWindow.length / 5;
      }
    },

    // Get performance stats for all components
    getPerformanceStats() {
      const stats = [];
      for (const [id, data] of this.components.entries()) {
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

      // Sort by total render time (slowest first)
      return stats.sort((a, b) => b.totalRenderTime - a.totalRenderTime);
    },

    // Profiling support
    profiling: false,
    profileData: [],
    profileStartTime: 0,

    startProfiling() {
      this.profiling = true;
      this.profileData = [];
      this.profileStartTime = performance.now();
      console.log('[Veda DevTools] Profiling started');
    },

    stopProfiling() {
      this.profiling = false;
      const duration = performance.now() - this.profileStartTime;
      console.log('[Veda DevTools] Profiling stopped, duration:', duration, 'ms');
      return {
        duration,
        events: this.profileData,
        summary: this.getProfilingSummary()
      };
    },

    recordProfileEvent(type, data) {
      if (!this.profiling) return;
      this.profileData.push({
        type,
        data,
        timestamp: performance.now() - this.profileStartTime
      });
    },

    getProfilingSummary() {
      const summary = {
        renders: 0,
        totalRenderTime: 0,
        effectTriggers: 0,
        modelUpdates: 0,
        componentsByRenders: {}
      };

      for (const event of this.profileData) {
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
    },

    // ========================================================================
    // Dependency Graph
    // ========================================================================

    findModelByModelId(modelId) {
      for (const data of this.models.values()) {
        if (data.modelId === modelId) {
          return data;
        }
      }
      return null;
    },

    getShortModelId(modelId) {
      if (!modelId) return 'unknown';
      // Get last part after last / or :
      const parts = modelId.split(/[/:]/);
      return parts[parts.length - 1] || modelId;
    },

    // ========================================================================
    // Subscription Tracking
    // ========================================================================

    subscriptions: new Map(),
    subscriptionHistory: [],
    maxSubscriptionHistory: 200,

    trackSubscription(id, updateCounter) {
      const now = Date.now();
      if (!this.subscriptions.has(id)) {
        this.subscriptions.set(id, {
          id,
          subscribedAt: now,
          updateCounter,
          updateCount: 0,
          lastUpdate: null
        });

        this.subscriptionHistory.push({
          type: 'subscribe',
          id,
          timestamp: now,
          updateCounter
        });

        // Keep history limited
        if (this.subscriptionHistory.length > this.maxSubscriptionHistory) {
          this.subscriptionHistory.shift();
        }

        this.emit('subscription:added', { id, updateCounter, timestamp: now });
      }
    },

    trackUnsubscription(id) {
      const now = Date.now();
      if (this.subscriptions.has(id)) {
        const data = this.subscriptions.get(id);
        this.subscriptions.delete(id);

        this.subscriptionHistory.push({
          type: 'unsubscribe',
          id,
          timestamp: now,
          duration: now - data.subscribedAt
        });

        if (this.subscriptionHistory.length > this.maxSubscriptionHistory) {
          this.subscriptionHistory.shift();
        }

        this.emit('subscription:removed', { id, timestamp: now });
      }
    },

    trackSubscriptionUpdate(id, updateCounter) {
      const data = this.subscriptions.get(id);
      if (data) {
        data.updateCount++;
        data.lastUpdate = Date.now();
        data.updateCounter = updateCounter;
      }
    },

    getSubscriptionStats() {
      return {
        active: Array.from(this.subscriptions.values()),
        history: this.subscriptionHistory.slice(-100),
        totalSubscriptions: this.subscriptions.size,
        wsConnected: this.wsConnected || false
      };
    },

    // WebSocket state
    wsConnected: false,
    wsAddress: null,

    // ========================================================================
    // Model Tracking
    // ========================================================================

    trackModel(model) {
      const modelId = model.id || model['@'];
      if (!modelId) return;

      // Check if already tracked by modelId
      const existing = this.modelToId.get(model);
      if (existing) {
        return existing;
      }

      // Check by modelId (different instance, same model)
      for (const [id, data] of this.models.entries()) {
        if (data.modelId === modelId) {
          this.modelToId.set(model, id);
          return id;
        }
      }

      const id = ++this.modelCounter;
      const isLoaded = typeof model.isLoaded === 'function' ? model.isLoaded() : false;
      const data = {
        id,
        modelRef: new WeakRef(model),  // WeakRef allows GC
        modelId,
        type: this.getModelType(model),
        isLoaded: isLoaded,
        properties: this.serializeModelProperties(model),
        createdAt: Date.now(),
        updateCount: 0
      };
      this.models.set(id, data);
      this.modelToId.set(model, id);
      modelRegistry.register(model, id);  // Auto-cleanup on GC

      this.addToTimeline('model:created', {
        id,
        modelId,
        type: data.type
      });

      this.emit('model:created', {
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

    trackModelUpdate(model) {
      const id = this.modelToId.get(model);
      if (!id) return;

      const data = this.models.get(id);
      if (!data) return;

      data.updateCount++;
      data.properties = this.serializeModelProperties(model);

      // Record for profiling
      this.recordProfileEvent('model-update', { id, type: data.type });

      // Update isLoaded status
      const isLoaded = typeof model.isLoaded === 'function' ? model.isLoaded() : false;
      data.isLoaded = isLoaded;

      // Update type if it was unknown before (model just loaded)
      const newType = this.getModelType(model);
      if (newType !== 'No type' && newType !== 'Unknown' && newType !== 'Error') {
        data.type = newType;
      }

      this.addToTimeline('model:updated', {
        id,
        modelId: data.modelId,
        type: data.type
      });

      this.emit('model:updated', {
        id,
        modelId: data.modelId,
        type: data.type,
        isLoaded: data.isLoaded,
        properties: data.properties,
        updateCount: data.updateCount
      });
    },

    // ========================================================================
    // Effect Tracking
    // ========================================================================

    // Current component context for effect creation
    currentComponentTag: null,

    setCurrentComponent(component) {
      if (component && component.tagName) {
        this.currentComponentTag = component.tagName.toLowerCase();
      }
    },

    clearCurrentComponent() {
      this.currentComponentTag = null;
    },

    trackEffect(effect) {
      // Check if already tracked
      const existingId = this.effectToId.get(effect);
      if (existingId) {
        return existingId;
      }

      const id = ++this.effectCounter;
      const effectName = this.getEffectInfo(effect);

      // Get component info from options.component or current context
      let componentTag = this.currentComponentTag;
      let componentId = null;
      const comp = effect.options?.component;
      if (comp) {
        // Try tagName first (for HTMLElement), then constructor name
        if (comp.tagName) {
          componentTag = comp.tagName.toLowerCase();
        } else if (comp.constructor?.name && comp.constructor.name !== 'Object') {
          componentTag = comp.constructor.name;
        }
        // Get component ID from DevTools tracking
        componentId = this.componentToId.get(comp) || null;
      }

      const data = {
        id,
        effectRef: new WeakRef(effect),  // WeakRef allows GC
        triggerCount: 0,
        lastTriggered: null,
        createdAt: Date.now(),
        name: effectName,
        componentTag,  // Component tag name
        componentId,   // Component instance ID
        dependencies: [],  // Track dependencies
        isComputed: effect.options?.computed || false,
        isLazy: effect.options?.lazy || false
      };
      this.effects.set(id, data);
      this.effectToId.set(effect, id);
      effectRegistry.register(effect, id);  // Auto-cleanup on GC

      this.addToTimeline('effect:created', { id });

      this.emit('effect:created', {
        id,
        createdAt: data.createdAt,
        triggerCount: 0,
        name: data.name,
        componentTag: data.componentTag
      });

      return id;
    },

    trackEffectDependency(effect, target, key) {
      try {
        const effectId = this.effectToId.get(effect);
        if (!effectId) return;

        const data = this.effects.get(effectId);
        if (!data) return;

        const keyStr = String(key);

        // Filter out noise: internal props, array indices, symbols
        if (keyStr === 'constructor' ||
            keyStr === 'length' ||
            keyStr === '__isReactive' ||
            keyStr === 'then' ||
            keyStr === 'toJSON' ||
            /^\d+$/.test(keyStr) ||  // array indices
            typeof key === 'symbol') {
          return;
        }

        // Get readable target identifier (only for models)
        let targetId = '';
        try {
          if (target && typeof target.id === 'string') {
            targetId = target.id;
          }
        } catch (e) {
          // Ignore
        }

        // Avoid duplicates
        const depKey = `${targetId}:${keyStr}`;
        if (!data.dependencies.some(d => d.key === depKey)) {
          data.dependencies.push({
            key: depKey,
            targetId,
            property: keyStr
          });
        }
      } catch (e) {
        // Silently fail to avoid breaking app
      }
    },

    trackEffectTrigger(effect) {
      const id = this.effectToId.get(effect);
      if (!id) return;

      const data = this.effects.get(id);
      if (data) {
        data.triggerCount++;
        data.lastTriggered = Date.now();

        // Record for profiling
        this.recordProfileEvent('effect', { id, triggerCount: data.triggerCount });

        // Only emit every N triggers to reduce noise
        if (data.triggerCount <= 10 || data.triggerCount % 5 === 0) {
          this.emit('effect:triggered', {
            id,
            triggerCount: data.triggerCount,
            lastTriggered: data.lastTriggered
          });
        }

        // Add to timeline for first few triggers or every 10th
        if (data.triggerCount <= 3 || data.triggerCount % 10 === 0) {
          this.addToTimeline('effect:triggered', {
            id,
            triggerCount: data.triggerCount
          });
        }
      }
    },

    untrackEffect(effect) {
      const id = this.effectToId.get(effect);
      if (!id) return;

      this.effects.delete(id);
      this.effectToId.delete(effect);

      this.addToTimeline('effect:removed', { id });
      this.emit('effect:removed', { id });
    },

    getEffectInfo(effect) {
      // Try to get meaningful name/description for effect
      try {
        // Check options.name first (explicitly set name)
        if (effect.options?.name && effect.options.name.length > 2) {
          return effect.options.name;
        }

        // Check if effect has a name property (for named effects)
        // Skip short names (minified) like "e", "t", etc.
        if (effect.name && effect.name !== 'effectFn' && effect.name.length > 2) {
          return effect.name;
        }

        // Try to get function name from toString
        const str = effect.toString();

        // Check for arrow function with property access pattern: () => this.xxx
        const arrowMatch = str.match(/\(\)\s*=>\s*this\.(\w+)/);
        if (arrowMatch && arrowMatch[1].length > 2) {
          return `computed: ${arrowMatch[1]}`;
        }

        // Check for getter pattern
        const getterMatch = str.match(/get\s+(\w+)\s*\(\)/);
        if (getterMatch && getterMatch[1].length > 2) {
          return `getter: ${getterMatch[1]}`;
        }

        // Try to extract function name (skip minified short names)
        const funcMatch = str.match(/function\s+(\w+)/);
        if (funcMatch && funcMatch[1] !== 'anonymous' && funcMatch[1].length > 2) {
          return funcMatch[1];
        }

      } catch (e) {
        // Ignore
      }
      return null;
    },

    // ========================================================================
    // Timeline
    // ========================================================================

    addToTimeline(event, data) {
      const entry = {
        id: Date.now() + Math.random(),
        event,
        data,
        timestamp: Date.now()
      };

      this.timeline.push(entry);

      // Keep timeline size limited
      if (this.timeline.length > this.maxTimelineEvents) {
        this.timeline.shift();
      }
    },

    // ========================================================================
    // Event Emitter
    // ========================================================================

    listeners: {},

    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    },

    off(event, callback) {
      if (!this.listeners[event]) return;
      if (!callback) {
        delete this.listeners[event];
      } else {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    },

    emit(event, data) {
      const listeners = this.listeners[event];
      if (listeners) {
        listeners.forEach(cb => {
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
    },

    // ========================================================================
    // Snapshot
    // ========================================================================

    getSnapshot() {
      // First pass: collect valid components and update childIds
      const validComponents = [];
      const validIds = new Set();

      for (const c of this.components.values()) {
        const component = c.componentRef.deref();
        if (component) {
          validIds.add(c.id);
          validComponents.push(c);
        }
      }

      return {
        components: validComponents.map(c => {
            const component = c.componentRef.deref();
            // Filter childIds to only include valid (non-GC'd) components
            const childIds = (c.childIds || []).filter(id => validIds.has(id));
            return {
              id: c.id,
              tagName: c.tagName,
              modelId: c.modelId,
              parentId: validIds.has(c.parentId) ? c.parentId : null,
              childIds,
              state: this.extractComponentState(component),
              renderCount: c.renderCount,
              createdAt: c.createdAt,
              // Performance data
              avgRenderTime: c.avgRenderTime || 0,
              maxRenderTime: c.maxRenderTime || 0,
              lastRenderTime: c.lastRenderTime || 0,
              totalRenderTime: c.totalRenderTime || 0,
              rendersPerSecond: c.rendersPerSecond || 0
            };
          }),
        models: Array.from(this.models.values())
          .map(m => {
            const model = m.modelRef.deref();
            if (!model) return null;  // Model was GC'd
            return {
              id: m.id,
              modelId: m.modelId,
              type: m.type,
              isLoaded: typeof model.isLoaded === 'function' ? model.isLoaded() : m.isLoaded,
              properties: this.serializeModelProperties(model),
              updateCount: m.updateCount,
              createdAt: m.createdAt
            };
          })
          .filter(Boolean),  // Remove GC'd models
        effects: Array.from(this.effects.values())
          .map(e => {
            const effect = e.effectRef.deref();
            if (!effect) return null;  // Effect was GC'd
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
          .filter(Boolean),  // Remove GC'd effects
        timeline: this.timeline.slice(-50),
        // Performance summary
        performance: {
          stats: this.getPerformanceStats(),
          profiling: this.profiling
        },
        // Subscription stats
        subscriptions: this.getSubscriptionStats()
      };
    },

    // ========================================================================
    // Serialization Helpers
    // ========================================================================

    extractComponentState(component) {
      const state = {};

      if (!component.state) return state;

      try {
        const stateObj = component.state;

        // Use for...in to enumerate all properties including inherited
        const keys = [];
        for (const key in stateObj) {
          if (Object.prototype.hasOwnProperty.call(stateObj, key)) {
            keys.push(key);
          }
        }


        for (const key of keys) {
          // Skip internal properties
          if (key.startsWith('_') || key.startsWith('#')) continue;
          // Skip reactive internals
          if (key === '__isReactive') continue;
          // Skip model (handled separately)
          if (key === 'model') continue;

          try {
            const value = stateObj[key];
            state[key] = this.serializeValue(value);
          } catch (e) {
            state[key] = '[Error]';
          }
        }
      } catch (e) {
        console.warn('[Veda DevTools] extractComponentState error:', e);
      }

      return state;
    },

    getModelType(model) {
      try {
        const type = model['rdf:type'] || model['@type'];
        if (!type) return 'No type';

        // rdf:type is usually an array of Model instances after Value.parse
        if (Array.isArray(type) && type.length > 0) {
          const t = type[0];
          // Model instance - has .id property
          if (t && typeof t === 'object' && t.id) {
            return t.id;
          }
          // Raw object with @ or data field
          if (t && typeof t === 'object') {
            return t['@'] || t.data || String(t);
          }
          // String value
          if (typeof t === 'string') {
            return t;
          }
          return String(t);
        }

        // Single Model instance
        if (typeof type === 'object' && type.id) {
          return type.id;
        }
        // Object with @ or data
        if (typeof type === 'object') {
          return type['@'] || type.data || 'Unknown';
        }
        // String
        if (typeof type === 'string') {
          return type;
        }

        return 'Unknown';
      } catch (e) {
        console.warn('[Veda DevTools] getModelType error:', e);
        return 'Error';
      }
    },

    serializeValue(value, depth = 0) {
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
          return value.map(item => this.serializeValue(item, depth + 1));
        }
        return value.slice(0, 5).map(item => this.serializeValue(item, depth + 1))
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
          result[key] = this.serializeValue(value[key], depth + 1);
        } catch (e) {
          result[key] = '[Error]';
        }
      }
      return result;
    },

    serializeModelProperties(model) {
      const props = {};

      if (!model) return props;

      try {
        for (const key in model) {
          // Only include RDF properties and standard ones
          if (key.startsWith('v-') || key.startsWith('rdf:') ||
              key.startsWith('rdfs:') || key.startsWith('@') ||
              key === 'id') {

            try {
              const value = model[key];
              if (Array.isArray(value)) {
                props[key] = value.slice(0, 10).map(v => {
                  // Handle Model references
                  if (typeof v === 'object' && v !== null) {
                    if (v.id || v['@']) {
                      return { _type: 'Model', id: v.id || v['@'] };
                    }
                    // Handle RDF value objects
                    if (v.data !== undefined) {
                      return v.data;
                    }
                  }
                  return this.serializeValue(v);
                });
                if (value.length > 10) {
                  props[key].push(`... +${value.length - 10} more`);
                }
              } else {
                props[key] = this.serializeValue(value);
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
  };

  // ========================================================================
  // Element Inspection & Highlighting
  // ========================================================================

  // Overlay element for highlighting
  let highlightOverlay = null;
  let highlightTimeout = null;
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

    // Add label for component name
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

    // Check if component is still in DOM
    if (!document.body.contains(highlightedComponent)) {
      hook.hideHighlight();
      return;
    }

    const rect = highlightedComponent.getBoundingClientRect();
    highlightOverlay.style.top = rect.top + 'px';
    highlightOverlay.style.left = rect.left + 'px';
    highlightOverlay.style.width = rect.width + 'px';
    highlightOverlay.style.height = rect.height + 'px';
  }

  hook.highlightElement = function(componentId) {
    const data = this.components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    highlightedComponent = component;
    const overlay = createHighlightOverlay();
    const label = overlay.querySelector('.__veda_devtools_label__');

    updateHighlightPosition();
    overlay.style.display = 'block';
    label.textContent = `<${data.tagName}>`;

    // Add scroll listener to update position
    if (!scrollHandler) {
      scrollHandler = () => updateHighlightPosition();
      window.addEventListener('scroll', scrollHandler, true);
      window.addEventListener('resize', scrollHandler);
    }

    // Watch for component removal from DOM
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    mutationObserver = new MutationObserver(() => {
      if (highlightedComponent && !document.body.contains(highlightedComponent)) {
        hook.hideHighlight();
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }

    return true;
  };

  hook.hideHighlight = function() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
    highlightedComponent = null;
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
      highlightTimeout = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  };

  hook.inspectElement = function(componentId) {
    const data = this.components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    // Set $v to the component for console access
    window.$v = component;

    // Also set $v0, $v1, etc. for history
    if (!window.__veda_inspect_history__) {
      window.__veda_inspect_history__ = [];
    }

    // Shift history
    const history = window.__veda_inspect_history__;
    history.unshift(component);
    if (history.length > 5) history.pop();

    // Update $v0, $v1, etc.
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
  };

  hook.scrollToElement = function(componentId) {
    const data = this.components.get(componentId);
    if (!data) return false;

    const component = data.componentRef.deref();
    if (!component) return false;

    component.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  };

  hook.getComponentElement = function(componentId) {
    const data = this.components.get(componentId);
    if (!data) return null;
    return data.componentRef.deref() || null;
  };

  // ========================================================================
  // State Editing
  // ========================================================================

  hook.setComponentState = function(componentId, key, value) {
    const data = this.components.get(componentId);
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
  };

  // Make hook globally available
  window.__VEDA_DEVTOOLS_HOOK__ = hook;

  // Listen for snapshot requests from DevTools
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data.source !== 'veda-devtools-request') return;

    if (event.data.type === 'get-snapshot') {
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'snapshot',
        data: hook.getSnapshot()
      }, '*');
    }

    // Handle highlight request
    if (event.data.type === 'highlight-element') {
      const result = hook.highlightElement(event.data.componentId);
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'highlight-result',
        success: result
      }, '*');
    }

    // Handle hide highlight request
    if (event.data.type === 'hide-highlight') {
      hook.hideHighlight();
    }

    // Handle inspect request
    if (event.data.type === 'inspect-element') {
      const result = hook.inspectElement(event.data.componentId);
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'inspect-result',
        success: result
      }, '*');
    }

    // Handle scroll to element request
    if (event.data.type === 'scroll-to-element') {
      const result = hook.scrollToElement(event.data.componentId);
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'scroll-result',
        success: result
      }, '*');
    }

    // Handle state editing
    if (event.data.type === 'set-component-state') {
      const result = hook.setComponentState(
        event.data.componentId,
        event.data.key,
        event.data.value
      );
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'set-state-result',
        success: result
      }, '*');
    }

    // Handle profiling commands
    if (event.data.type === 'start-profiling') {
      hook.startProfiling();
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'profiling-started'
      }, '*');
    }

    if (event.data.type === 'stop-profiling') {
      const result = hook.stopProfiling();
      window.postMessage({
        source: 'veda-devtools-hook',
        type: 'profiling-result',
        data: result
      }, '*');
    }

    // Get performance stats
    if (event.data.type === 'get-performance') {
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

  // ========================================================================
  // Intercept Subscription class to track subscriptions
  // ========================================================================

  function interceptSubscription() {
    // Wait for Subscription class to be available
    const checkInterval = setInterval(() => {
      // Look for Subscription class in various places
      let Subscription = null;

      // Check if it's exported from veda-client
      if (window.Subscription) {
        Subscription = window.Subscription;
      }

      // Check in any loaded modules
      if (!Subscription && window.__VEDA_SUBSCRIPTION__) {
        Subscription = window.__VEDA_SUBSCRIPTION__;
      }

      if (Subscription && Subscription.subscribe && !Subscription._devtoolsIntercepted) {
        Subscription._devtoolsIntercepted = true;

        // Store original methods
        const originalSubscribe = Subscription.subscribe.bind(Subscription);
        const originalUnsubscribe = Subscription.unsubscribe.bind(Subscription);

        // Intercept subscribe
        Subscription.subscribe = function(ref, subscription) {
          const [id, updateCounter] = subscription;
          hook.trackSubscription(id, updateCounter);
          return originalSubscribe(ref, subscription);
        };

        // Intercept unsubscribe
        Subscription.unsubscribe = function(id) {
          hook.trackUnsubscription(id);
          return originalUnsubscribe(id);
        };

        // Track WebSocket state
        if (Subscription._socket) {
          hook.wsConnected = Subscription._socket.readyState === 1;
          hook.wsAddress = Subscription._address;
        }

        // Sync existing subscriptions
        if (Subscription._subscriptions && Subscription._subscriptions.size > 0) {
          for (const [id, subscription] of Subscription._subscriptions.entries()) {
            const updateCounter = subscription[1] || 0;
            hook.trackSubscription(id, updateCounter);
          }
          console.log('[Veda DevTools] Synced', Subscription._subscriptions.size, 'existing subscriptions');
        }

        // Intercept _receive to track updates
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

          // Re-assign onmessage to use new intercepted _receive
          if (Subscription._socket) {
            Subscription._socket.onmessage = Subscription._receive;
          }
        }

        // Monitor socket state changes
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

    // Stop checking after 30 seconds
    setTimeout(() => clearInterval(checkInterval), 30000);
  }

  // Start intercepting
  interceptSubscription();
})();
