import {effect, track, trigger} from './Effect.js';

// WeakMap to store already wrapped reactive objects
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

  // Don't wrap already reactive objects
  if (target.__isReactive) {
    return target;
  }

  // Check if we already wrapped this object (prevents circular references)
  const existingProxy = reactiveMap.get(target);
  if (existingProxy) {
    return existingProxy;
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
          const mutationMethods = ['push', 'pop', 'shift', 'unshift', 'splice'];
          const sortingMethods = ['sort', 'reverse'];
          
          // Methods that always modify array
          if (mutationMethods.includes(key)) {
            return function(...args) {
              const result = value.apply(target, args);
              // Trigger all effects that access any property of this array
              trigger(target, null, true);
              return result;
            };
          }
          
          // Methods that may or may not modify (sort, reverse)
          // Only trigger if array actually changed
          if (sortingMethods.includes(key)) {
            return function(...args) {
              // Snapshot array before operation
              const before = [...target];
              const result = value.apply(target, args);
              
              // Check if array actually changed
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

  const proxy = new Proxy(target, handler);

  // Store the proxy to prevent creating multiple proxies for the same object
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

  // The computed object that will be returned
  const computed = {
    get value() {
      // Re-compute if dirty
      if (dirty) {
        // Run getter to compute value
        // The effect wrapper will track dependencies
        value = getter();
        dirty = false;
      }
      // Track that something accessed this computed value
      track(this, 'value');
      return value;
    }
  };

  // Create an effect that runs the getter
  // This effect will be triggered when dependencies change
  effect(() => {
    // Access the computed value to set up tracking
    // This creates the dependency link
    // eslint-disable-next-line no-unused-expressions
    computed.value;
  }, {
    lazy: false, // Run immediately
    computed: true,
    scheduler: () => {
      // When dependencies change, mark as dirty
      if (!dirty) {
        dirty = true;
        // Trigger effects that depend on this computed value
        trigger(computed, 'value');
      }
    }
  });

  return computed;
}

export {effect};
