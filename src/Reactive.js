import {effect, track, trigger} from './Effect.js';

const reactiveMap = new WeakMap();

// Dangerous property names that could cause prototype pollution
const DANGEROUS_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

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

  const proxy = new Proxy(target, {
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
        // Return the function bound to the receiver (proxy), not target
        // This ensures that methods like addValue/removeValue work with the proxy
        return value.bind(receiver);
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
    // Security: Silently ignore dangerous property names to prevent prototype pollution
    if (typeof key === 'string' && DANGEROUS_PROPS.has(key)) {
      console.warn(`Reactive.set: Blocked dangerous property name: ${key}`);
      return true; // Return true to avoid TypeError in strict mode
    }

    const oldValue = target[key];
    const oldLength = Array.isArray(target) ? target.length : undefined;
    
    const result = Reflect.set(target, key, value, receiver);

    if (oldValue !== value) {
      trigger(target, key);

      // For arrays: if index assignment changed length, trigger length too
      if (Array.isArray(target) && oldLength !== undefined) {
        const newLength = target.length;
        if (oldLength !== newLength) {
          trigger(target, 'length');
        }
      }

      if (options.onSet && typeof key !== 'symbol') {
        options.onSet.call(proxy, key, value, oldValue);
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
          options.onDelete.call(proxy, key);
        }
      }

      return result;
    }
  });

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
