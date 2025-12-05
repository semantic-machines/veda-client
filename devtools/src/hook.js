"use strict";
(() => {
  // devtools/src/hook/EventEmitter.js
  var EventEmitter = class {
    constructor() {
      this.listeners = {};
    }
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }
    off(event, callback) {
      if (!this.listeners[event]) return;
      if (!callback) {
        delete this.listeners[event];
      } else {
        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
      }
    }
    emit(event, data) {
      const eventListeners = this.listeners[event];
      if (eventListeners) {
        eventListeners.forEach((cb) => {
          try {
            cb(data);
          } catch (e) {
            console.warn("[Veda DevTools] Listener error:", e);
          }
        });
      }
      window.postMessage({
        source: "veda-devtools-hook",
        event,
        data
      }, "*");
    }
  };

  // devtools/src/hook/Timeline.js
  var Timeline = class {
    constructor(maxEvents = 100) {
      this.timeline = [];
      this.maxEvents = maxEvents;
    }
    add(event, data) {
      const entry = {
        id: Date.now() + Math.random(),
        event,
        data,
        timestamp: Date.now()
      };
      this.timeline.push(entry);
      if (this.timeline.length > this.maxEvents) {
        this.timeline.shift();
      }
    }
    get(limit = 50) {
      return this.timeline.slice(-limit);
    }
    clear() {
      this.timeline.length = 0;
    }
  };

  // devtools/src/hook/Serializer.js
  var Serializer = class {
    serializeValue(value, depth = 0) {
      if (depth > 3) return "[Deep Object]";
      if (value === null) return null;
      if (value === void 0) return void 0;
      const type = typeof value;
      if (type === "function") return "[Function]";
      if (type !== "object") return value;
      if (value.id || value["@"]) {
        return { _type: "Model", id: value.id || value["@"] };
      }
      if (value instanceof Date) return value.toISOString();
      if (value instanceof RegExp) return value.toString();
      if (value instanceof Set) return `Set(${value.size})`;
      if (value instanceof Map) return `Map(${value.size})`;
      if (Array.isArray(value)) {
        if (value.length === 0) return [];
        if (value.length <= 5) {
          return value.map((item) => this.serializeValue(item, depth + 1));
        }
        return value.slice(0, 5).map((item) => this.serializeValue(item, depth + 1)).concat([`... +${value.length - 5} more`]);
      }
      const result = {};
      let count = 0;
      for (const key in value) {
        if (key.startsWith("_") || key.startsWith("#")) continue;
        if (count++ > 15) {
          result["..."] = `${Object.keys(value).length - 15} more`;
          break;
        }
        try {
          result[key] = this.serializeValue(value[key], depth + 1);
        } catch (e) {
          result[key] = "[Error]";
        }
      }
      return result;
    }
    extractComponentState(component) {
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
          if (key.startsWith("_") || key.startsWith("#")) continue;
          if (key === "__isReactive") continue;
          if (key === "model") continue;
          try {
            const value = stateObj[key];
            state[key] = this.serializeValue(value);
          } catch (e) {
            state[key] = "[Error]";
          }
        }
      } catch (e) {
        console.warn("[Veda DevTools] extractComponentState error:", e);
      }
      return state;
    }
    getModelType(model) {
      try {
        const type = model["rdf:type"] || model["@type"];
        if (!type) return "No type";
        if (Array.isArray(type) && type.length > 0) {
          const t = type[0];
          if (t && typeof t === "object" && t.id) return t.id;
          if (t && typeof t === "object") return t["@"] || t.data || String(t);
          if (typeof t === "string") return t;
          return String(t);
        }
        if (typeof type === "object" && type.id) return type.id;
        if (typeof type === "object") return type["@"] || type.data || "Unknown";
        if (typeof type === "string") return type;
        return "Unknown";
      } catch (e) {
        console.warn("[Veda DevTools] getModelType error:", e);
        return "Error";
      }
    }
    serializeModelProperties(model) {
      const props = {};
      if (!model) return props;
      try {
        for (const key in model) {
          if (key.startsWith("v-") || key.startsWith("rdf:") || key.startsWith("rdfs:") || key.startsWith("@") || key === "id") {
            try {
              const value = model[key];
              if (Array.isArray(value)) {
                props[key] = value.slice(0, 10).map((v) => {
                  if (typeof v === "object" && v !== null) {
                    if (v.id || v["@"]) {
                      return { _type: "Model", id: v.id || v["@"] };
                    }
                    if (v.data !== void 0) {
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
              props[key] = "[Error]";
            }
          }
        }
      } catch (e) {
      }
      return props;
    }
  };

  // devtools/src/hook/Profiler.js
  var Profiler = class {
    constructor() {
      this.profiling = false;
      this.profileData = [];
      this.profileStartTime = 0;
    }
    start() {
      this.profiling = true;
      this.profileData = [];
      this.profileStartTime = performance.now();
      console.log("[Veda DevTools] Profiling started");
    }
    stop() {
      this.profiling = false;
      const duration = performance.now() - this.profileStartTime;
      console.log("[Veda DevTools] Profiling stopped, duration:", duration, "ms");
      return {
        duration,
        events: this.profileData.slice(),
        summary: this.getSummary()
      };
    }
    record(type, data) {
      if (!this.profiling) return;
      this.profileData.push({
        type,
        data,
        timestamp: performance.now() - this.profileStartTime
      });
    }
    getSummary() {
      const summary = {
        renders: 0,
        totalRenderTime: 0,
        effectTriggers: 0,
        modelUpdates: 0,
        componentsByRenders: {}
      };
      for (const event of this.profileData) {
        if (event.type === "render") {
          summary.renders++;
          summary.totalRenderTime += event.data.time || 0;
          const tag = event.data.tagName || "unknown";
          summary.componentsByRenders[tag] = (summary.componentsByRenders[tag] || 0) + 1;
        } else if (event.type === "effect") {
          summary.effectTriggers++;
        } else if (event.type === "model-update") {
          summary.modelUpdates++;
        }
      }
      return summary;
    }
  };

  // devtools/src/hook/ComponentTracker.js
  var ComponentTracker = class {
    constructor(emit, addToTimeline, extractState) {
      this.emit = emit;
      this.addToTimeline = addToTimeline;
      this.extractState = extractState;
      this.components = /* @__PURE__ */ new Map();
      this.componentToId = /* @__PURE__ */ new WeakMap();
      this.componentCounter = 0;
      this.registry = new FinalizationRegistry((id) => {
        this.components.delete(id);
        this.addToTimeline("component:removed", { id });
        this.emit("component:removed", { id });
      });
    }
    findParentComponentId(component) {
      let el = component.parentElement;
      while (el) {
        const parentId = this.componentToId.get(el);
        if (parentId) return parentId;
        el = el.parentElement;
      }
      return null;
    }
    getComponentModelId(component) {
      try {
        if (component.state?.model?.id) return component.state.model.id;
        if (component.state?.model?.["@"]) return component.state.model["@"];
        if (component.model?.id) return component.model.id;
        if (component.model?.["@"]) return component.model["@"];
        return null;
      } catch (e) {
        return null;
      }
    }
    track(component) {
      const existingId = this.componentToId.get(component);
      if (existingId) return existingId;
      const id = ++this.componentCounter;
      const parentId = this.findParentComponentId(component);
      const data = {
        id,
        componentRef: new WeakRef(component),
        tagName: component.tagName?.toLowerCase() || "unknown",
        modelId: this.getComponentModelId(component),
        parentId,
        childIds: [],
        createdAt: Date.now(),
        renderCount: 0
      };
      this.components.set(id, data);
      this.componentToId.set(component, id);
      this.registry.register(component, id);
      if (parentId) {
        const parentData = this.components.get(parentId);
        if (parentData && !parentData.childIds.includes(id)) {
          parentData.childIds.push(id);
        }
      }
      this.addToTimeline("component:created", {
        id,
        tagName: data.tagName,
        modelId: data.modelId
      });
      this.emit("component:created", {
        id,
        tagName: data.tagName,
        modelId: data.modelId,
        parentId,
        state: this.extractState(component),
        createdAt: data.createdAt,
        renderCount: 0
      });
      return id;
    }
    untrack(component) {
      const id = this.componentToId.get(component);
      if (!id) return;
      const data = this.components.get(id);
      const tagName = data?.tagName || "unknown";
      if (data?.parentId) {
        const parentData = this.components.get(data.parentId);
        if (parentData) {
          parentData.childIds = parentData.childIds.filter((cid) => cid !== id);
        }
      }
      this.components.delete(id);
      this.componentToId.delete(component);
      this.addToTimeline("component:removed", { id, tagName });
      this.emit("component:removed", { id, tagName });
    }
    trackStateChange(component) {
      const id = this.componentToId.get(component);
      if (!id) return;
      const data = this.components.get(id);
      if (!data) return;
      const newModelId = this.getComponentModelId(component);
      if (newModelId !== data.modelId) {
        data.modelId = newModelId;
      }
      const newState = this.extractState(component);
      this.addToTimeline("component:state-changed", {
        id,
        tagName: data.tagName
      });
      this.emit("component:state-changed", {
        id,
        state: newState,
        modelId: data.modelId
      });
    }
    trackRender(component, startTime, recordProfileEvent) {
      const id = this.componentToId.get(component);
      if (!id) return;
      const data = this.components.get(id);
      if (!data) return;
      data.renderCount++;
      const renderTime = startTime ? performance.now() - startTime : 0;
      recordProfileEvent("render", {
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
      const cutoff = Date.now() - 5e3;
      data.renderWindow = data.renderWindow.filter((t) => t > cutoff);
      data.rendersPerSecond = data.renderWindow.length / 5;
    }
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
      return stats.sort((a, b) => b.totalRenderTime - a.totalRenderTime);
    }
  };

  // devtools/src/hook/ModelTracker.js
  var ModelTracker = class {
    constructor(emit, addToTimeline, serializeProperties, getModelType) {
      this.emit = emit;
      this.addToTimeline = addToTimeline;
      this.serializeProperties = serializeProperties;
      this.getModelType = getModelType;
      this.models = /* @__PURE__ */ new Map();
      this.modelToId = /* @__PURE__ */ new WeakMap();
      this.modelCounter = 0;
      this.registry = new FinalizationRegistry((id) => {
        this.models.delete(id);
        this.addToTimeline("model:removed", { id });
        this.emit("model:removed", { id });
      });
    }
    track(model) {
      const modelId = model.id || model["@"];
      if (!modelId) return;
      const existing = this.modelToId.get(model);
      if (existing) return existing;
      for (const [id2, data2] of this.models.entries()) {
        if (data2.modelId === modelId) {
          this.modelToId.set(model, id2);
          return id2;
        }
      }
      const id = ++this.modelCounter;
      const isLoaded = typeof model.isLoaded === "function" ? model.isLoaded() : false;
      const data = {
        id,
        modelRef: new WeakRef(model),
        modelId,
        type: this.getModelType(model),
        isLoaded,
        properties: this.serializeProperties(model),
        createdAt: Date.now(),
        updateCount: 0
      };
      this.models.set(id, data);
      this.modelToId.set(model, id);
      this.registry.register(model, id);
      this.addToTimeline("model:created", {
        id,
        modelId,
        type: data.type
      });
      this.emit("model:created", {
        id,
        modelId,
        type: data.type,
        isLoaded: data.isLoaded,
        properties: data.properties,
        createdAt: data.createdAt,
        updateCount: 0
      });
      return id;
    }
    trackUpdate(model, recordProfileEvent) {
      const id = this.modelToId.get(model);
      if (!id) return;
      const data = this.models.get(id);
      if (!data) return;
      data.updateCount++;
      data.properties = this.serializeProperties(model);
      recordProfileEvent("model-update", { id, type: data.type });
      const isLoaded = typeof model.isLoaded === "function" ? model.isLoaded() : false;
      data.isLoaded = isLoaded;
      const newType = this.getModelType(model);
      if (newType !== "No type" && newType !== "Unknown" && newType !== "Error") {
        data.type = newType;
      }
      this.addToTimeline("model:updated", {
        id,
        modelId: data.modelId,
        type: data.type
      });
      this.emit("model:updated", {
        id,
        modelId: data.modelId,
        type: data.type,
        isLoaded: data.isLoaded,
        properties: data.properties,
        updateCount: data.updateCount
      });
    }
    findByModelId(modelId) {
      for (const data of this.models.values()) {
        if (data.modelId === modelId) {
          return data;
        }
      }
      return null;
    }
  };

  // devtools/src/hook/EffectTracker.js
  var EffectTracker = class {
    constructor(emit, addToTimeline, componentToId) {
      this.emit = emit;
      this.addToTimeline = addToTimeline;
      this.componentToId = componentToId;
      this.effects = /* @__PURE__ */ new Map();
      this.effectToId = /* @__PURE__ */ new WeakMap();
      this.effectCounter = 0;
      this.registry = new FinalizationRegistry((id) => {
        this.effects.delete(id);
        this.addToTimeline("effect:removed", { id });
        this.emit("effect:removed", { id });
      });
    }
    getEffectInfo(effect) {
      try {
        if (effect.options?.name && effect.options.name.length > 2) {
          return effect.options.name;
        }
        if (effect.name && effect.name !== "effectFn" && effect.name.length > 2) {
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
        if (funcMatch && funcMatch[1] !== "anonymous" && funcMatch[1].length > 2) {
          return funcMatch[1];
        }
      } catch (e) {
      }
      return null;
    }
    track(effect) {
      const existingId = this.effectToId.get(effect);
      if (existingId) return existingId;
      const id = ++this.effectCounter;
      const effectName = this.getEffectInfo(effect);
      let componentTag = null;
      let componentId = null;
      const comp = effect.options?.component;
      if (comp) {
        if (comp.tagName) {
          componentTag = comp.tagName.toLowerCase();
        } else if (comp.constructor?.name && comp.constructor.name !== "Object") {
          componentTag = comp.constructor.name;
        }
        componentId = this.componentToId.get(comp) || null;
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
      this.effects.set(id, data);
      this.effectToId.set(effect, id);
      this.registry.register(effect, id);
      this.addToTimeline("effect:created", { id });
      this.emit("effect:created", {
        id,
        createdAt: data.createdAt,
        triggerCount: 0,
        name: data.name,
        componentTag: data.componentTag
      });
      return id;
    }
    trackDependency(effect, target, key) {
      try {
        const effectId = this.effectToId.get(effect);
        if (!effectId) return;
        const data = this.effects.get(effectId);
        if (!data) return;
        const keyStr = String(key);
        if (keyStr === "constructor" || keyStr === "length" || keyStr === "__isReactive" || keyStr === "then" || keyStr === "toJSON" || /^\d+$/.test(keyStr) || typeof key === "symbol") {
          return;
        }
        let targetId = "";
        try {
          if (target && typeof target.id === "string") {
            targetId = target.id;
          }
        } catch (e) {
        }
        const depKey = `${targetId}:${keyStr}`;
        if (!data.dependencies.some((d) => d.key === depKey)) {
          data.dependencies.push({
            key: depKey,
            targetId,
            property: keyStr
          });
        }
      } catch (e) {
      }
    }
    trackTrigger(effect, recordProfileEvent) {
      const id = this.effectToId.get(effect);
      if (!id) return;
      const data = this.effects.get(id);
      if (!data) return;
      data.triggerCount++;
      data.lastTriggered = Date.now();
      recordProfileEvent("effect", { id, triggerCount: data.triggerCount });
      if (data.triggerCount <= 10 || data.triggerCount % 5 === 0) {
        this.emit("effect:triggered", {
          id,
          triggerCount: data.triggerCount,
          lastTriggered: data.lastTriggered
        });
      }
      if (data.triggerCount <= 3 || data.triggerCount % 10 === 0) {
        this.addToTimeline("effect:triggered", {
          id,
          triggerCount: data.triggerCount
        });
      }
    }
    untrack(effect) {
      const id = this.effectToId.get(effect);
      if (!id) return;
      this.effects.delete(id);
      this.effectToId.delete(effect);
      this.addToTimeline("effect:removed", { id });
      this.emit("effect:removed", { id });
    }
  };

  // devtools/src/hook/SubscriptionTracker.js
  var SubscriptionTracker = class {
    constructor(emit) {
      this.emit = emit;
      this.subscriptions = /* @__PURE__ */ new Map();
      this.subscriptionHistory = [];
      this.maxSubscriptionHistory = 200;
    }
    track(id, updateCounter) {
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
          type: "subscribe",
          id,
          timestamp: now,
          updateCounter
        });
        if (this.subscriptionHistory.length > this.maxSubscriptionHistory) {
          this.subscriptionHistory.shift();
        }
        this.emit("subscription:added", { id, updateCounter, timestamp: now });
      }
    }
    trackUnsubscription(id) {
      const now = Date.now();
      if (this.subscriptions.has(id)) {
        const data = this.subscriptions.get(id);
        this.subscriptions.delete(id);
        this.subscriptionHistory.push({
          type: "unsubscribe",
          id,
          timestamp: now,
          duration: now - data.subscribedAt
        });
        if (this.subscriptionHistory.length > this.maxSubscriptionHistory) {
          this.subscriptionHistory.shift();
        }
        this.emit("subscription:removed", { id, timestamp: now });
      }
    }
    trackUpdate(id, updateCounter) {
      const data = this.subscriptions.get(id);
      if (data) {
        data.updateCount++;
        data.lastUpdate = Date.now();
        data.updateCounter = updateCounter;
      }
    }
    getStats(wsConnected) {
      return {
        active: Array.from(this.subscriptions.values()),
        history: this.subscriptionHistory.slice(-100),
        totalSubscriptions: this.subscriptions.size,
        wsConnected: wsConnected || false
      };
    }
  };

  // devtools/src/hook/Inspector.js
  var Inspector = class {
    constructor(components) {
      this.components = components;
      this.highlightOverlay = null;
      this.highlightedComponent = null;
      this.scrollHandler = null;
      this.mutationObserver = null;
    }
    createHighlightOverlay() {
      if (this.highlightOverlay) return this.highlightOverlay;
      this.highlightOverlay = document.createElement("div");
      this.highlightOverlay.id = "__veda_devtools_highlight__";
      this.highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      border: 2px solid #0e639c;
      background: rgba(14, 99, 156, 0.1);
      display: none;
    `;
      const label = document.createElement("div");
      label.className = "__veda_devtools_label__";
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
      this.highlightOverlay.appendChild(label);
      document.body.appendChild(this.highlightOverlay);
      return this.highlightOverlay;
    }
    updateHighlightPosition() {
      if (!this.highlightedComponent || !this.highlightOverlay) return;
      if (!document.body.contains(this.highlightedComponent)) {
        this.hideHighlight();
        return;
      }
      const rect = this.highlightedComponent.getBoundingClientRect();
      this.highlightOverlay.style.top = rect.top + "px";
      this.highlightOverlay.style.left = rect.left + "px";
      this.highlightOverlay.style.width = rect.width + "px";
      this.highlightOverlay.style.height = rect.height + "px";
    }
    highlightElement(componentId) {
      const data = this.components.get(componentId);
      if (!data) return false;
      const component = data.componentRef.deref();
      if (!component) return false;
      this.highlightedComponent = component;
      const overlay = this.createHighlightOverlay();
      const label = overlay.querySelector(".__veda_devtools_label__");
      this.updateHighlightPosition();
      overlay.style.display = "block";
      label.textContent = `<${data.tagName}>`;
      if (!this.scrollHandler) {
        this.scrollHandler = () => this.updateHighlightPosition();
        window.addEventListener("scroll", this.scrollHandler, true);
        window.addEventListener("resize", this.scrollHandler);
      }
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
      }
      this.mutationObserver = new MutationObserver(() => {
        if (this.highlightedComponent && !document.body.contains(this.highlightedComponent)) {
          this.hideHighlight();
        }
      });
      this.mutationObserver.observe(document.body, { childList: true, subtree: true });
      return true;
    }
    hideHighlight() {
      if (this.highlightOverlay) {
        this.highlightOverlay.style.display = "none";
      }
      this.highlightedComponent = null;
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
    }
    inspectElement(componentId) {
      const data = this.components.get(componentId);
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
        window["$v" + i] = el;
      });
      console.log(
        "%c[Veda DevTools]%c Selected component stored in %c$v%c",
        "color: #0e639c; font-weight: bold;",
        "color: inherit;",
        "color: #4ec9b0; font-weight: bold;",
        "color: inherit;"
      );
      return true;
    }
    scrollToElement(componentId) {
      const data = this.components.get(componentId);
      if (!data) return false;
      const component = data.componentRef.deref();
      if (!component) return false;
      component.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    setComponentState(componentId, key, value) {
      const data = this.components.get(componentId);
      if (!data) return false;
      const component = data.componentRef.deref();
      if (!component || !component.state) return false;
      try {
        component.state[key] = value;
        return true;
      } catch (e) {
        console.warn("[Veda DevTools] Failed to set state:", e);
        return false;
      }
    }
  };

  // devtools/src/hook-entry.js
  (function() {
    if (window.__VEDA_DEVTOOLS_HOOK__) return;
    const emitter = new EventEmitter();
    const timeline = new Timeline(100);
    const serializer = new Serializer();
    const profiler = new Profiler();
    const componentTracker = new ComponentTracker(
      emitter.emit.bind(emitter),
      timeline.add.bind(timeline),
      serializer.extractComponentState.bind(serializer)
    );
    const modelTracker = new ModelTracker(
      emitter.emit.bind(emitter),
      timeline.add.bind(timeline),
      serializer.serializeModelProperties.bind(serializer),
      serializer.getModelType.bind(serializer)
    );
    const effectTracker = new EffectTracker(
      emitter.emit.bind(emitter),
      timeline.add.bind(timeline),
      componentTracker.componentToId
    );
    const subscriptionTracker = new SubscriptionTracker(emitter.emit.bind(emitter));
    const inspector = new Inspector(componentTracker.components);
    const hook = {
      // Component tracking
      trackComponent: (comp) => componentTracker.track(comp),
      untrackComponent: (comp) => componentTracker.untrack(comp),
      trackComponentStateChange: (comp) => componentTracker.trackStateChange(comp),
      trackComponentRender: (comp, startTime) => componentTracker.trackRender(comp, startTime, profiler.record.bind(profiler)),
      // Model tracking
      trackModel: (model) => modelTracker.track(model),
      trackModelUpdate: (model) => modelTracker.trackUpdate(model, profiler.record.bind(profiler)),
      // Effect tracking
      trackEffect: (effect) => effectTracker.track(effect),
      trackEffectDependency: (effect, target, key) => effectTracker.trackDependency(effect, target, key),
      trackEffectTrigger: (effect) => effectTracker.trackTrigger(effect, profiler.record.bind(profiler)),
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
      get profiling() {
        return profiler.profiling;
      },
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
        const validIds = /* @__PURE__ */ new Set();
        for (const c of componentTracker.components.values()) {
          const component = c.componentRef.deref();
          if (component) {
            validIds.add(c.id);
            validComponents.push(c);
          }
        }
        return {
          components: validComponents.map((c) => {
            const component = c.componentRef.deref();
            const childIds = (c.childIds || []).filter((id) => validIds.has(id));
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
          models: Array.from(modelTracker.models.values()).map((m) => {
            const model = m.modelRef.deref();
            if (!model) return null;
            return {
              id: m.id,
              modelId: m.modelId,
              type: m.type,
              isLoaded: typeof model.isLoaded === "function" ? model.isLoaded() : m.isLoaded,
              properties: serializer.serializeModelProperties(model),
              updateCount: m.updateCount,
              createdAt: m.createdAt
            };
          }).filter(Boolean),
          effects: Array.from(effectTracker.effects.values()).map((e) => {
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
          }).filter(Boolean),
          timeline: timeline.get(50),
          performance: {
            stats: componentTracker.getPerformanceStats(),
            profiling: profiler.profiling
          },
          subscriptions: subscriptionTracker.getStats(hook.wsConnected)
        };
      }
    };
    window.__VEDA_DEVTOOLS_HOOK__ = hook;
    window.addEventListener("message", function(event) {
      if (event.source !== window) return;
      if (event.data.source !== "veda-devtools-request") return;
      const { type, componentId, key, value } = event.data;
      if (type === "get-snapshot") {
        window.postMessage({
          source: "veda-devtools-hook",
          type: "snapshot",
          data: hook.getSnapshot()
        }, "*");
      }
      if (type === "highlight-element") {
        const result = hook.highlightElement(componentId);
        window.postMessage({
          source: "veda-devtools-hook",
          type: "highlight-result",
          success: result
        }, "*");
      }
      if (type === "hide-highlight") {
        hook.hideHighlight();
      }
      if (type === "inspect-element") {
        const result = hook.inspectElement(componentId);
        window.postMessage({
          source: "veda-devtools-hook",
          type: "inspect-result",
          success: result
        }, "*");
      }
      if (type === "scroll-to-element") {
        const result = hook.scrollToElement(componentId);
        window.postMessage({
          source: "veda-devtools-hook",
          type: "scroll-result",
          success: result
        }, "*");
      }
      if (type === "set-component-state") {
        const result = hook.setComponentState(componentId, key, value);
        window.postMessage({
          source: "veda-devtools-hook",
          type: "set-state-result",
          success: result
        }, "*");
      }
      if (type === "start-profiling") {
        hook.startProfiling();
        window.postMessage({
          source: "veda-devtools-hook",
          type: "profiling-started"
        }, "*");
      }
      if (type === "stop-profiling") {
        const result = hook.stopProfiling();
        window.postMessage({
          source: "veda-devtools-hook",
          type: "profiling-result",
          data: result
        }, "*");
      }
      if (type === "get-performance") {
        window.postMessage({
          source: "veda-devtools-hook",
          type: "performance-stats",
          data: hook.getPerformanceStats()
        }, "*");
      }
    });
    window.postMessage({
      source: "veda-devtools-hook",
      event: "hook:ready",
      data: {}
    }, "*");
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
            console.log("[Veda DevTools] Synced", Subscription._subscriptions.size, "existing subscriptions");
          }
          const originalReceive = Subscription._receive;
          if (originalReceive) {
            Subscription._receive = function(event) {
              const msg = event.data;
              if (msg && msg !== "") {
                const ids = (msg.indexOf("=") === 0 ? msg.substr(1) : msg).split(",");
                for (const pairStr of ids) {
                  const pair = pairStr.split("=");
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
                hook.emit("ws:state-changed", {
                  connected: hook.wsConnected,
                  address: hook.wsAddress
                });
              }, 100);
              return result;
            };
          }
          console.log("[Veda DevTools] Subscription tracking enabled");
          clearInterval(checkInterval);
        }
      }, 500);
      setTimeout(() => clearInterval(checkInterval), 3e4);
    }
    interceptSubscription();
  })();
})();
