/**
 * Veda Client DevTools Hook
 * Injected into page to track reactive state and components
 */

(function() {
  if (window.__VEDA_DEVTOOLS_HOOK__) return;

  const hook = {
    // Registries
    components: new Map(),
    componentCounter: 0,
    componentToId: new WeakMap(), // Track component instance to ID mapping
    models: new Map(),
    modelCounter: 0,
    effects: new Map(),
    effectCounter: 0,
    effectToId: new WeakMap(), // Track effect to ID mapping

    // Timeline of events
    timeline: [],
    maxTimelineEvents: 100,

    // Track component creation
    trackComponent(component) {
      // Check if already tracked
      const existingId = this.componentToId.get(component);
      if (existingId) {
        return existingId;
      }

      const id = ++this.componentCounter;
      const data = {
        id,
        component,
        tagName: component.tagName?.toLowerCase() || 'unknown',
        modelId: component.model?.id || component.model?.['@'] || null,
        createdAt: Date.now(),
        renderCount: 0
      };
      this.components.set(id, data);
      this.componentToId.set(component, id);

      this.addToTimeline('component:created', {
        id,
        tagName: data.tagName,
        modelId: data.modelId
      });

      this.emit('component:created', {
        id,
        tagName: data.tagName,
        modelId: data.modelId,
        state: this.extractComponentState(component)
      });
      return id;
    },

    // Untrack component on disconnect
    untrackComponent(component) {
      const id = this.componentToId.get(component);
      if (!id) return;

      this.components.delete(id);
      this.componentToId.delete(component);

      this.addToTimeline('component:removed', { id });
      this.emit('component:removed', { id });
    },

    // Track component state change
    trackComponentStateChange(component) {
      const id = this.componentToId.get(component);
      if (!id) return;

      const data = this.components.get(id);
      if (!data) return;

      // Update stored state
      const newState = this.extractComponentState(component);

      this.emit('component:state-changed', {
        id,
        state: newState
      });
    },

    // Track model creation
    trackModel(model) {
      const modelId = model.id || model['@'];
      if (!modelId) return;

      // Check if already tracked
      for (const [id, data] of this.models.entries()) {
        if (data.modelId === modelId) {
          return id;
        }
      }

      const id = ++this.modelCounter;
      const data = {
        id,
        model,
        modelId,
        properties: this.serializeModelProperties(model),
        createdAt: Date.now(),
        updateCount: 0
      };
      this.models.set(id, data);

      this.addToTimeline('model:created', {
        id,
        modelId,
        type: this.getModelType(model)
      });

      this.emit('model:created', {
        id,
        modelId,
        properties: data.properties
      });
      return id;
    },

    // Track effect creation and execution
    trackEffect(effect) {
      // Check if already tracked
      const existingId = this.effectToId.get(effect);
      if (existingId) {
        return existingId;
      }

      const id = ++this.effectCounter;
      const data = {
        id,
        effect,
        triggerCount: 0,
        lastTriggered: null,
        createdAt: Date.now()
      };
      this.effects.set(id, data);
      this.effectToId.set(effect, id);

      this.emit('effect:created', { id, createdAt: data.createdAt });
      return id;
    },

    // Track effect trigger
    trackEffectTrigger(effect) {
      const id = this.effectToId.get(effect);
      if (!id) return;

      const data = this.effects.get(id);
      if (data) {
        data.triggerCount++;
        data.lastTriggered = Date.now();

        this.emit('effect:triggered', {
          id,
          triggerCount: data.triggerCount,
          lastTriggered: data.lastTriggered
        });
      }
    },

    // Untrack effect
    untrackEffect(effect) {
      const id = this.effectToId.get(effect);
      if (!id) return;

      this.effects.delete(id);
      this.effectToId.delete(effect);

      this.emit('effect:removed', { id });
    },

    // Add event to timeline
    addToTimeline(event, data) {
      this.timeline.push({
        event,
        data,
        timestamp: Date.now()
      });

      // Keep timeline size limited
      if (this.timeline.length > this.maxTimelineEvents) {
        this.timeline.shift();
      }
    },

    // Event emitter
    listeners: {},
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    },

    emit(event, data) {
      const listeners = this.listeners[event];
      if (listeners) {
        listeners.forEach(cb => cb(data));
      }

      // Send to DevTools panel via postMessage
      window.postMessage({
        source: 'veda-devtools-hook',
        event,
        data
      }, '*');
    },

    // Get current state snapshot
    getSnapshot() {
      return {
        components: Array.from(this.components.values()).map(c => ({
          id: c.id,
          tagName: c.tagName,
          modelId: c.modelId,
          state: this.extractComponentState(c.component),
          renderCount: c.renderCount,
          createdAt: c.createdAt
        })),
        models: Array.from(this.models.values()).map(m => ({
          id: m.id,
          modelId: m.modelId,
          type: this.getModelType(m.model),
          properties: this.serializeModelProperties(m.model),
          updateCount: m.updateCount,
          createdAt: m.createdAt
        })),
        effects: Array.from(this.effects.values()).map(e => ({
          id: e.id,
          triggerCount: e.triggerCount,
          lastTriggered: e.lastTriggered,
          createdAt: e.createdAt
        })),
        timeline: this.timeline.slice(-50) // Last 50 events
      };
    },

    // Extract component state
    extractComponentState(component) {
      const state = {};

      // Get reactive state
      if (component.state) {
        for (const key in component.state) {
          try {
            const value = component.state[key];
            state[key] = this.serializeValue(value);
          } catch (e) {
            state[key] = '[Error]';
          }
        }
      }

      return state;
    },

    // Get model type from rdf:type
    getModelType(model) {
      try {
        const type = model['rdf:type'] || model['@type'];
        if (Array.isArray(type) && type[0]) {
          return type[0].id || type[0]['@'] || String(type[0]);
        }
        return type?.id || type?.['@'] || String(type) || 'Unknown';
      } catch (e) {
        return 'Unknown';
      }
    },

    // Serialize value for display
    serializeValue(value, depth = 0) {
      if (depth > 3) return '[Deep Object]';
      if (value === null) return null;
      if (value === undefined) return undefined;

      const type = typeof value;
      if (type === 'function') return '[Function]';
      if (type !== 'object') return value;

      if (value instanceof Date) return value.toISOString();
      if (value instanceof RegExp) return value.toString();

      if (Array.isArray(value)) {
        return value.slice(0, 10).map(item => this.serializeValue(item, depth + 1));
      }

      // Plain object
      const result = {};
      let count = 0;
      for (const key in value) {
        if (count++ > 20) {
          result['...'] = `${Object.keys(value).length - 20} more`;
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

    // Serialize Model properties for display
    serializeModelProperties(model) {
      const props = {};

      // Get all RDF properties
      for (const key in model) {
        if (key.startsWith('v-') || key.startsWith('rdf:') || key.startsWith('@') || key === 'id') {
          try {
            const value = model[key];
            if (Array.isArray(value)) {
              props[key] = value.slice(0, 10).map(v => {
                // Handle Model references
                if (typeof v === 'object' && v !== null && (v.id || v['@'])) {
                  return {
                    _type: 'Model',
                    id: v.id || v['@']
                  };
                }
                return this.serializeValue(v);
              });
            } else {
              props[key] = this.serializeValue(value);
            }
          } catch (e) {
            props[key] = '[Error]';
          }
        }
      }
      return props;
    },

    // Serialize target for display (legacy, for compatibility)
    serializeTarget(obj, depth = 0, seen = new WeakSet()) {
      return this.serializeValue(obj, depth);
    }
  };

  // Make hook globally available
  window.__VEDA_DEVTOOLS_HOOK__ = hook;

  // Listen for snapshot requests from DevTools
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data.source !== 'veda-devtools-request') return;

    if (event.data.type === 'get-snapshot') {
      // Send snapshot back
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

  console.log('[Veda DevTools] Hook installed');
})();

