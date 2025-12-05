/**
 * Model Tracker Module
 * Tracks model instances and their updates
 */

export function createModelTracker(emit, addToTimeline, serializeProperties, getModelType) {
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

