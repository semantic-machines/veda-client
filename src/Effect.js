/**
 * Effect system for dependency tracking and reactive updates
 * Based on Vue 3's reactivity system
 */

let activeEffect = null;
const targetMap = new WeakMap();
const effectStack = [];
let shouldTrack = true;

// Queue for batching effect execution
const effectQueue = new Set();
let isFlushing = false;
let isFlushPending = false;

// Infinite loop detection
const MAX_TRIGGER_COUNT = 100;
const effectTriggerCount = new WeakMap();

/**
 * Queue an effect for execution
 */
function queueEffect(effect) {
  // Track trigger count for infinite loop detection
  const count = effectTriggerCount.get(effect) || 0;

  if (count >= MAX_TRIGGER_COUNT) {
    console.error(
      `Infinite loop detected: Effect triggered ${count} times in a single update cycle.`,
      'This usually means an effect is modifying state it depends on.',
      effect
    );
    return;
  }

  effectTriggerCount.set(effect, count + 1);
  effectQueue.add(effect);
  queueFlush();
}

/**
 * Schedule effect queue flush
 */
function queueFlush() {
  if (!isFlushPending && !isFlushing) {
    isFlushPending = true;
    queueMicrotask(flushEffects);
  }
}

/**
 * Flush all queued effects
 * @returns {Promise<void>}
 */
async function flushEffects() {
  if (isFlushing) return Promise.resolve();

  isFlushPending = false;
  isFlushing = true;

  try {
    // Sort effects by priority (computed first)
    const sortedEffects = Array.from(effectQueue).sort((a, b) => {
      if (a.options?.computed && !b.options?.computed) return -1;
      if (!a.options?.computed && b.options?.computed) return 1;
      return 0;
    });

    effectQueue.clear();

    for (const effect of sortedEffects) {
      if (effect.options?.scheduler) {
        effect.options.scheduler(effect);
      } else {
        effect();
      }
    }

    // Clear trigger counts after successful flush
    // This allows effects to trigger again in next update cycle
    sortedEffects.forEach(effect => effectTriggerCount.delete(effect));

  } finally {
    isFlushing = false;

    // If more effects were queued during flush, flush again
    if (effectQueue.size > 0) {
      queueFlush();
    }
  }

  return Promise.resolve();
}

/**
 * Creates an effect that automatically tracks dependencies and re-runs when they change
 * @param {Function} fn - The effect function to run
 * @param {Object} options - Effect options
 * @returns {Function} - Function to stop the effect
 */
export function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn);
    effectStack.push(effectFn);
    activeEffect = effectFn;
    shouldTrack = true;

    try {
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  };

  effectFn.deps = [];
  effectFn.options = options;

  if (!options.lazy) {
    effectFn();
  }

  return () => {
    cleanup(effectFn);
  };
}

/**
 * Track property access for the current active effect
 * @param {Object} target - The target object
 * @param {string|symbol} key - The property key
 */
export function track(target, key) {
  if (!activeEffect || !shouldTrack) {
    return;
  }

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}

/**
 * Trigger all effects that depend on a property
 * @param {Object} target - The target object
 * @param {string|symbol} key - The property key
 * @param {boolean} triggerAll - If true, trigger all effects for this target
 */
export function trigger(target, key, triggerAll = false) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }

  const effectsToQueue = new Set();

  const add = (effectsToAdd) => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect => {
        // Don't trigger effect if it's currently running
        if (effect !== activeEffect) {
          effectsToQueue.add(effect);
        }
      });
    }
  };

  if (triggerAll) {
    // Trigger all effects for this target (used for array mutations)
    depsMap.forEach(dep => add(dep));
  } else {
    // Add effects for this specific key
    add(depsMap.get(key));
  }

  // Queue all effects for batched execution
  effectsToQueue.forEach(effect => queueEffect(effect));
}

/**
 * Clean up effect dependencies
 * @param {Function} effect - The effect to clean up
 */
function cleanup(effect) {
  const {deps} = effect;
  if (deps.length) {
    for (const dep of deps) {
      dep.delete(effect);
    }
    deps.length = 0;
  }
}

/**
 * Pause tracking temporarily
 */
export function pauseTracking() {
  shouldTrack = false;
}

/**
 * Resume tracking
 */
export function resumeTracking() {
  shouldTrack = true;
}

/**
 * Stop tracking for a function call
 * @param {Function} fn - Function to run without tracking
 * @returns {*} - Return value of fn
 */
export function untrack(fn) {
  pauseTracking();
  try {
    return fn();
  } finally {
    resumeTracking();
  }
}

/**
 * Export flushEffects for testing
 */
export { flushEffects };

