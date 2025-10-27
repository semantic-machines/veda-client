import {effect, track, trigger} from './Effect.js';

/**
 * Creates a reactive proxy that tracks property access and triggers updates
 * @param {Object} target - The object to make reactive
 * @param {Object} options - Options for reactive behavior
 * @param {Function} options.onSet - Callback when property is set
 * @param {Function} options.onDelete - Callback when property is deleted
 * @returns {Proxy} - Reactive proxy object
 */
export function reactive(target, options = {}) {
  if (typeof target !== 'object' || target === null) {
    return target;
  }

  // Don't wrap already reactive objects
  if (target.__isReactive) {
    return target;
  }

  const handler = {
    get(target, key, receiver) {
      // Special marker for reactive detection
      if (key === '__isReactive') {
        return true;
      }

      // Track this property access
      track(target, key);

      const value = Reflect.get(target, key, receiver);

      // Bind functions to maintain correct context
      if (typeof value === 'function') {
        // For arrays, wrap mutation methods to trigger reactivity
        if (Array.isArray(target)) {
          const arrayMethods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
          if (arrayMethods.includes(key)) {
            return function(...args) {
              const result = value.apply(target, args);
              // Trigger all effects that access any property of this array
              trigger(target, null, true);
              return result;
            };
          }
        }
        return value.bind(target);
      }

      // Deep reactivity - wrap nested objects
      // But skip Promises, Dates, and other special objects
      if (typeof value === 'object' && value !== null) {
        // Don't wrap Promise, Date, RegExp, etc
        if (value instanceof Promise || value instanceof Date || value instanceof RegExp) {
          return value;
        }
        return reactive(value, options);
      }

      return value;
    },

    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);

      // Only trigger if value actually changed
      if (oldValue !== value) {
        trigger(target, key);

        // Call custom onSet handler if provided
        if (options.onSet && typeof key !== 'symbol') {
          options.onSet.call(target, key, value, oldValue);
        }
      }

      return result;
    },

    deleteProperty(target, key) {
      const hadKey = key in target;
      const result = Reflect.deleteProperty(target, key);

      if (hadKey) {
        trigger(target, key);

        // Call custom onDelete handler if provided
        if (options.onDelete && typeof key !== 'symbol') {
          options.onDelete.call(target, key);
        }
      }

      return result;
    }
  };

  return new Proxy(target, handler);
}

/**
 * Creates a computed property that automatically tracks dependencies
 * @param {Function} getter - The getter function
 * @returns {Object} - Object with value getter
 */
export function computed(getter) {
  let value;
  let dirty = true;
  let effect;

  const computedEffect = () => {
    if (dirty) {
      effect = getter();
      value = effect;
      dirty = false;
    }
    return value;
  };

  // Mark for invalidation when dependencies change
  const invalidate = () => {
    dirty = true;
  };

  return {
    get value() {
      const result = computedEffect();
      track(computedEffect, 'value');
      return result;
    },
    effect: invalidate
  };
}

export {effect};
