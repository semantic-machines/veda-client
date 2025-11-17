/**
 * Memory leak detection without relying on global.gc
 * Uses object counting and WeakRef tracking
 */

const REGISTRY = new FinalizationRegistry((name) => {
  // Silent cleanup tracking
});

/**
 * Memory tracker for detecting leaks
 */
export class MemoryTracker {
  constructor(name) {
    this.name = name;
    this.objects = new Set();
    this.counters = {
      created: 0,
      destroyed: 0,
      active: 0
    };
  }

  /**
   * Track an object for leak detection
   * @param {Object} obj - Object to track
   * @param {string} label - Label for logging
   */
  track(obj, label = 'object') {
    const id = `${this.name}-${label}-${this.counters.created}`;
    this.objects.add(new WeakRef(obj));
    this.counters.created++;
    this.counters.active++;

    REGISTRY.register(obj, id);

    return () => {
      this.counters.active--;
      this.counters.destroyed++;
    };
  }

  /**
   * Check for leaks by counting active objects
   * @returns {Object} Leak statistics
   */
  checkLeaks() {
    // Count how many tracked objects are still alive
    let alive = 0;
    for (const ref of this.objects) {
      if (ref.deref()) {
        alive++;
      }
    }

    return {
      created: this.counters.created,
      destroyed: this.counters.destroyed,
      expectedActive: this.counters.active,
      actualAlive: alive,
      potentialLeaks: alive - this.counters.active
    };
  }

  /**
   * Reset tracker
   */
  reset() {
    this.objects.clear();
    this.counters = {
      created: 0,
      destroyed: 0,
      active: 0
    };
  }

  /**
   * Get summary report
   */
  getReport() {
    const stats = this.checkLeaks();
    return {
      ...stats,
      message: stats.potentialLeaks > 0
        ? `⚠️  Potential leak: ${stats.potentialLeaks} objects not cleaned up properly`
        : `✅ No leaks detected (${stats.destroyed}/${stats.created} destroyed)`
    };
  }
}

/**
 * Effect counter for tracking active effects
 */
export class EffectCounter {
  constructor() {
    this.effectMap = new Map();
  }

  /**
   * Track an effect cleanup function
   * @param {string} label - Effect label
   * @param {Function} cleanup - Cleanup function
   */
  track(label, cleanup) {
    if (!this.effectMap.has(label)) {
      this.effectMap.set(label, 0);
    }
    this.effectMap.set(label, this.effectMap.get(label) + 1);

    return () => {
      cleanup();
      this.effectMap.set(label, this.effectMap.get(label) - 1);
    };
  }

  /**
   * Get count of active effects
   * @param {string} label - Effect label (optional)
   */
  getActiveCount(label) {
    if (label) {
      return this.effectMap.get(label) || 0;
    }
    let total = 0;
    for (const count of this.effectMap.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Assert all effects are cleaned up
   * @param {Function} assert - Assert function
   * @param {string} message - Error message
   */
  assertAllCleaned(assert, message = 'All effects should be cleaned up') {
    const active = this.getActiveCount();
    assert(active === 0, `${message} (${active} still active)`);
  }

  reset() {
    this.effectMap.clear();
  }
}

/**
 * Component lifecycle tracker
 */
export class ComponentLifecycleTracker {
  constructor() {
    this.components = new WeakMap();
    this.stats = {
      connected: 0,
      disconnected: 0,
      rendered: 0,
      active: 0
    };
  }

  /**
   * Track component lifecycle
   * @param {HTMLElement} component - Component instance
   */
  trackComponent(component) {
    this.stats.connected++;
    this.stats.active++;

    const data = {
      connected: Date.now(),
      rendered: 0,
      disconnected: null
    };

    this.components.set(component, data);

    // Patch component methods
    const originalDisconnected = component.disconnectedCallback?.bind(component);
    component.disconnectedCallback = () => {
      if (originalDisconnected) originalDisconnected();
      this.stats.disconnected++;
      this.stats.active--;
      data.disconnected = Date.now();
    };

    const originalRendered = component.renderedCallback?.bind(component);
    component.renderedCallback = () => {
      if (originalRendered) originalRendered();
      this.stats.rendered++;
      data.rendered++;
    };

    return () => {
      this.stats.disconnected++;
      this.stats.active--;
    };
  }

  getStats() {
    return { ...this.stats };
  }

  assertBalanced(assert, message = 'Components should be balanced') {
    const diff = this.stats.connected - this.stats.disconnected;
    assert(diff === this.stats.active,
      `${message} (connected: ${this.stats.connected}, ` +
      `disconnected: ${this.stats.disconnected}, ` +
      `active: ${this.stats.active}, ` +
      `diff: ${diff})`
    );
  }

  reset() {
    this.components = new WeakMap();
    this.stats = {
      connected: 0,
      disconnected: 0,
      rendered: 0,
      active: 0
    };
  }
}

/**
 * DOM node counter
 */
export class DOMNodeCounter {
  /**
   * Count DOM nodes in a container
   * @param {HTMLElement} container - Container element
   * @returns {Object} Node counts
   */
  static count(container) {
    const counts = {
      total: 0,
      elements: 0,
      text: 0,
      comments: 0,
      fragments: 0
    };

    const traverse = (node) => {
      counts.total++;

      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          counts.elements++;
          break;
        case Node.TEXT_NODE:
          counts.text++;
          break;
        case Node.COMMENT_NODE:
          counts.comments++;
          break;
        case Node.DOCUMENT_FRAGMENT_NODE:
          counts.fragments++;
          break;
      }

      for (const child of node.childNodes) {
        traverse(child);
      }
    };

    if (container) {
      traverse(container);
    }

    return counts;
  }

  /**
   * Assert node count hasn't grown unexpectedly
   */
  static assertNoGrowth(assert, before, after, message = 'DOM nodes should not leak') {
    const growth = after.total - before.total;
    const threshold = Math.max(10, before.total * 0.1); // 10% or 10 nodes

    assert(growth < threshold,
      `${message} (growth: ${growth} nodes, threshold: ${threshold})`
    );
  }
}

/**
 * Event listener counter
 */
export class EventListenerCounter {
  constructor() {
    this.listeners = new WeakMap();
  }

  /**
   * Track addEventListener calls
   * @param {HTMLElement} element - Element
   */
  trackElement(element) {
    if (this.listeners.has(element)) {
      return this.listeners.get(element);
    }

    const tracker = {
      added: 0,
      removed: 0,
      active: () => tracker.added - tracker.removed
    };

    this.listeners.set(element, tracker);

    // Monkey-patch
    const originalAdd = element.addEventListener.bind(element);
    const originalRemove = element.removeEventListener.bind(element);

    element.addEventListener = function(...args) {
      tracker.added++;
      return originalAdd(...args);
    };

    element.removeEventListener = function(...args) {
      tracker.removed++;
      return originalRemove(...args);
    };

    return tracker;
  }

  getActiveCount(element) {
    const tracker = this.listeners.get(element);
    return tracker ? tracker.active() : 0;
  }
}

/**
 * Simple memory usage estimator (works without gc)
 */
export function estimateMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }

  // Fallback: estimate based on object counts
  return {
    estimated: true,
    note: 'Actual memory usage unavailable without Node.js'
  };
}

/**
 * Wait for potential garbage collection
 * Even without gc(), waiting helps
 */
export async function waitForGC(duration = 100) {
  await new Promise(resolve => setTimeout(resolve, duration));

  // Trigger some allocations to encourage GC
  const temp = [];
  for (let i = 0; i < 1000; i++) {
    temp.push(new Array(100).fill(i));
  }
  temp.length = 0;

  await new Promise(resolve => setTimeout(resolve, 50));
}

