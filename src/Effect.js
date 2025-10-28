/**
 * Effect system for dependency tracking and reactive updates
 * Based on Vue 3's reactivity system
 */

let activeEffect = null;
const targetMap = new WeakMap();
const effectStack = [];
let shouldTrack = true;

const effectQueue = new Set();
let isFlushing = false;
let isFlushPending = false;

const MAX_TRIGGER_COUNT = 100;
const effectTriggerCount = new WeakMap();

function queueEffect(effect) {
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

function queueFlush() {
  if (!isFlushPending && !isFlushing) {
    isFlushPending = true;
    queueMicrotask(flushEffects);
  }
}

async function flushEffects() {
  if (isFlushing) return Promise.resolve();

  isFlushPending = false;
  isFlushing = true;

  try {
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

    sortedEffects.forEach(effect => effectTriggerCount.delete(effect));

  } finally {
    isFlushing = false;

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
        if (effect !== activeEffect) {
          effectsToQueue.add(effect);
        }
      });
    }
  };

  if (triggerAll) {
    depsMap.forEach(dep => add(dep));
  } else {
    add(depsMap.get(key));
  }

  effectsToQueue.forEach(effect => queueEffect(effect));
}

function cleanup(effect) {
  const {deps} = effect;
  if (deps.length) {
    for (const dep of deps) {
      dep.delete(effect);
    }
    deps.length = 0;
  }
}

export function pauseTracking() {
  shouldTrack = false;
}

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

export { flushEffects };

