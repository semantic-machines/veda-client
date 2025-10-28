import {effect, track, trigger} from './Effect.js';

const reactiveMap = new WeakMap();

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

  if (target.__isReactive) {
    return target;
  }

  const existingProxy = reactiveMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  const handler = {
    get(target, key, receiver) {
      if (key === '__isReactive') {
        return true;
      }

      track(target, key);

      const value = Reflect.get(target, key, receiver);

      if (typeof value === 'function') {
        if (Array.isArray(target)) {
          const mutationMethods = ['push', 'pop', 'shift', 'unshift', 'splice'];
          const sortingMethods = ['sort', 'reverse'];

          if (mutationMethods.includes(key)) {
            return function(...args) {
              const result = value.apply(target, args);
              trigger(target, null, true);
              return result;
            };
          }

          if (sortingMethods.includes(key)) {
            return function(...args) {
              const before = [...target];
              const result = value.apply(target, args);

              const changed = before.length !== target.length ||
                             before.some((val, idx) => val !== target[idx]);

              if (changed) {
                trigger(target, null, true);
              }

              return result;
            };
          }
        }
        return value.bind(target);
      }

      if (typeof value === 'object' && value !== null) {
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

      if (oldValue !== value) {
        trigger(target, key);

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

        if (options.onDelete && typeof key !== 'symbol') {
          options.onDelete.call(target, key);
        }
      }

      return result;
    }
  };

  const proxy = new Proxy(target, handler);
  reactiveMap.set(target, proxy);

  return proxy;
}

/**
 * Creates a computed property that automatically tracks dependencies
 * @param {Function} getter - The getter function
 * @returns {Object} - Object with value getter
 */
export function computed(getter) {
  let value;
  let dirty = true;

  const computed = {
    get value() {
      if (dirty) {
        value = getter();
        dirty = false;
      }
      track(this, 'value');
      return value;
    }
  };

  effect(() => {
    void computed.value;
  }, {
    lazy: false,
    computed: true,
    scheduler: () => {
      if (!dirty) {
        dirty = true;
        trigger(computed, 'value');
      }
    }
  });

  return computed;
}

export {effect};
