/**
 * Model Tracker
 * Tracks model instances and their updates
 */

export class ModelTracker {
  constructor(emit, addToTimeline, serializeProperties, getModelType) {
    this.emit = emit;
    this.addToTimeline = addToTimeline;
    this.serializeProperties = serializeProperties;
    this.getModelType = getModelType;

    this.models = new Map();
    this.modelToId = new WeakMap();
    this.modelCounter = 0;
    this.pendingUpdates = new Map();
    this.updateScheduled = false;

    this.registry = new FinalizationRegistry((held) => {
      const data = this.models.get(held.id);
      if (!data || data.generation !== held.generation) return;
      this.models.delete(held.id);
      this.addToTimeline('model:removed', { id: held.id });
      this.emit('model:removed', { id: held.id });
    });
  }

  quietly(fn) {
    const untrack = globalThis.window?.__VEDA_DEVTOOLS_HOOK__?.untrack;
    return typeof untrack === 'function' ? untrack(fn) : fn();
  }

  retain(model, id, data) {
    data.generation = (data.generation || 0) + 1;
    if (data.unregisterToken) this.registry.unregister(data.unregisterToken);
    data.unregisterToken = {};
    data.modelRef = new WeakRef(model);
    this.registry.register(model, { id, generation: data.generation }, data.unregisterToken);
  }

  scheduleUpdate(model, recordProfileEvent) {
    this.pendingUpdates.set(model, recordProfileEvent);
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    queueMicrotask(() => {
      this.quietly(() => {
        this.updateScheduled = false;
        const pending = this.pendingUpdates;
        this.pendingUpdates = new Map();
        for (const [pendingModel, record] of pending) {
          this.trackUpdate(pendingModel, record);
        }
      });
    });
  }

  track(model) {
    const modelId = model.id || model['@'];
    if (!modelId) return;

    const existing = this.modelToId.get(model);
    if (existing) return existing;

    // Check by modelId (different instance, same model)
    for (const [id, data] of this.models.entries()) {
      if (data.modelId === modelId) {
        if (!data.modelRef.deref()) this.retain(model, id, data);
        this.modelToId.set(model, id);
        return id;
      }
    }

    const id = ++this.modelCounter;
    const isLoaded = typeof model.isLoaded === 'function' ? model.isLoaded() : false;
    const data = {
      id,
      modelRef: new WeakRef(model),
      modelId,
      type: this.quietly(() => this.getModelType(model)),
      isLoaded,
      properties: this.quietly(() => this.serializeProperties(model)),
      createdAt: Date.now(),
      updateCount: 0
    };

    this.models.set(id, data);
    this.modelToId.set(model, id);
    this.retain(model, id, data);

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
  }

  trackUpdate(model, recordProfileEvent) {
    const id = this.modelToId.get(model);
    if (!id) return;

    const data = this.models.get(id);
    if (!data) return;

    data.updateCount++;
    data.properties = this.quietly(() => this.serializeProperties(model));

    recordProfileEvent('model-update', { id, type: data.type });

    const isLoaded = typeof model.isLoaded === 'function' ? model.isLoaded() : false;
    data.isLoaded = isLoaded;

    const newType = this.quietly(() => this.getModelType(model));
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
  }

  findByModelId(modelId) {
    for (const data of this.models.values()) {
      if (data.modelId === modelId) {
        return data;
      }
    }
    return null;
  }
}
