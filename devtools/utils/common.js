/**
 * Debounce utility
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Throttle utility
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

/**
 * Deep clone object (for serialization)
 * @param {*} obj - Object to clone
 * @param {number} maxDepth - Maximum depth to clone
 * @param {number} currentDepth - Current depth
 * @returns {*} Cloned object
 */
export function deepClone(obj, maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) return '[Max Depth]';
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item, maxDepth, currentDepth + 1));
  }
  
  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key], maxDepth, currentDepth + 1);
    }
  }
  return cloned;
}

/**
 * Check if value is plain object
 * @param {*} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Safe JSON stringify with circular reference handling
 * @param {*} obj
 * @param {number} maxDepth
 * @returns {string}
 */
export function safeStringify(obj, maxDepth = 3) {
  const seen = new WeakSet();
  
  function replacer(depth) {
    return function(key, value) {
      if (depth > maxDepth) return '[Max Depth]';
      
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      
      return value;
    };
  }
  
  try {
    return JSON.stringify(obj, replacer(0));
  } catch (e) {
    return '[Serialization Error]';
  }
}

