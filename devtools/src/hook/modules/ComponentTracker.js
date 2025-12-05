/**
 * Component Tracker
 * Tracks component lifecycle, rendering, and state
 */

export class ComponentTracker {
  constructor(emit, addToTimeline, extractState) {
    this.emit = emit;
    this.addToTimeline = addToTimeline;
    this.extractState = extractState;

    this.components = new Map();
    this.componentToId = new WeakMap();
    this.componentCounter = 0;

    this.registry = new FinalizationRegistry((id) => {
      this.components.delete(id);
      this.addToTimeline('component:removed', { id });
      this.emit('component:removed', { id });
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
      if (component.state?.model?.['@']) return component.state.model['@'];
      if (component.model?.id) return component.model.id;
      if (component.model?.['@']) return component.model['@'];
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
      tagName: component.tagName?.toLowerCase() || 'unknown',
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
    const tagName = data?.tagName || 'unknown';

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

    this.addToTimeline('component:state-changed', {
      id,
      tagName: data.tagName
    });

    this.emit('component:state-changed', {
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
}
