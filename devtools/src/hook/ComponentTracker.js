/**
 * Component Tracker Module
 * Tracks component lifecycle, rendering, and state
 */

export function createComponentTracker(emit, addToTimeline, extractState) {
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

