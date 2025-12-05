/**
 * Effect Tracker Module
 * Tracks reactive effects and their dependencies
 */

export function createEffectTracker(emit, addToTimeline, componentToId) {
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

