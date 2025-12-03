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
      const data = {
        id,
        componentRef: new WeakRef(component),  // WeakRef allows GC
        tagName: component.tagName?.toLowerCase() || 'unknown',
        modelId: this.getComponentModelId(component),
        createdAt: Date.now(),
        renderCount: 0
      };
      this.components.set(id, data);
      this.componentToId.set(component, id);
      componentRegistry.register(component, id);  // Auto-cleanup on GC

      this.addToTimeline('component:created', {
        id,
        tagName: data.tagName,
        modelId: data.modelId
      });

      this.emit('component:created', {
        id,
        tagName: data.tagName,
        modelId: data.modelId,
        state: this.extractComponentState(component),
        createdAt: data.createdAt,
        renderCount: 0
      });

      return id;
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

    trackComponentRender(component) {
      const id = this.componentToId.get(component);
      if (!id) return;

      const data = this.components.get(id);
      if (data) {
        data.renderCount++;
      }
    },

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

    trackEffect(effect) {
      // Check if already tracked
      const existingId = this.effectToId.get(effect);
      if (existingId) {
        return existingId;
      }

      const id = ++this.effectCounter;
      const data = {
        id,
        effectRef: new WeakRef(effect),  // WeakRef allows GC
        triggerCount: 0,
        lastTriggered: null,
        createdAt: Date.now(),
        source: this.getEffectSource(effect)
      };
      this.effects.set(id, data);
      this.effectToId.set(effect, id);
      effectRegistry.register(effect, id);  // Auto-cleanup on GC

      this.addToTimeline('effect:created', { id });

      this.emit('effect:created', {
        id,
        createdAt: data.createdAt,
        triggerCount: 0,
        source: data.source
      });

      return id;
    },

    trackEffectTrigger(effect) {
      const id = this.effectToId.get(effect);
      if (!id) return;

      const data = this.effects.get(id);
      if (data) {
        data.triggerCount++;
        data.lastTriggered = Date.now();

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

    getEffectSource(effect) {
      try {
        if (effect.toString) {
          const str = effect.toString();
          // Extract first 100 chars of function body
          const match = str.match(/\{([\s\S]*)\}/);
          if (match) {
            return match[1].trim().slice(0, 100);
          }
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
      return {
        components: Array.from(this.components.values())
          .map(c => {
            const component = c.componentRef.deref();
            if (!component) return null;  // Component was GC'd
            return {
              id: c.id,
              tagName: c.tagName,
              modelId: c.modelId,
              state: this.extractComponentState(component),
              renderCount: c.renderCount,
              createdAt: c.createdAt
            };
          })
          .filter(Boolean),  // Remove GC'd components
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
              source: e.source
            };
          })
          .filter(Boolean),  // Remove GC'd effects
        timeline: this.timeline.slice(-50)
      };
    },

    // ========================================================================
    // Serialization Helpers
    // ========================================================================

    extractComponentState(component) {
      const state = {};

      if (!component.state) return state;

      try {
        for (const key in component.state) {
          // Skip internal properties
          if (key.startsWith('_') || key.startsWith('#')) continue;
          // Skip model (handled separately)
          if (key === 'model') continue;

          try {
            const value = component.state[key];
            state[key] = this.serializeValue(value);
          } catch (e) {
            state[key] = '[Error]';
          }
        }
      } catch (e) {
        // Component state may not be enumerable
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
  });

  // Notify that hook is ready
  window.postMessage({
    source: 'veda-devtools-hook',
    event: 'hook:ready',
    data: {}
  }, '*');
})();
