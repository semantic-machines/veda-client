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

    this.registry = new FinalizationRegistry((id) => {
      this.models.delete(id);
      this.addToTimeline('model:removed', { id });
      this.emit('model:removed', { id });
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
      type: this.getModelType(model),
      isLoaded,
      properties: this.serializeProperties(model),
      createdAt: Date.now(),
      updateCount: 0
    };

    this.models.set(id, data);
    this.modelToId.set(model, id);
    this.registry.register(model, id);

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
    data.properties = this.serializeProperties(model);

    recordProfileEvent('model-update', { id, type: data.type });

    const isLoaded = typeof model.isLoaded === 'function' ? model.isLoaded() : false;
    data.isLoaded = isLoaded;

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
