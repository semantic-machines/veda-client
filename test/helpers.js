/**
 * Test helpers for reducing boilerplate code
 */

import { flushEffects } from '../src/Effect.js';
import Model from '../src/Model.js';

/**
 * Creates a test component with automatic cleanup
 * @param {Function} ComponentClass - Component class constructor
 * @param {Object} options - Configuration options
 * @param {Function} options.setup - Setup function called before component is added to DOM
 * @param {boolean} options.autoRender - Whether to wait for render (default: true)
 * @returns {Promise<{component, container, cleanup}>}
 */
export async function createTestComponent(ComponentClass, options = {}) {
  const { setup = null, autoRender = true } = options;

  // Generate unique tag name to avoid conflicts
  const tag = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  ComponentClass.tag = tag;

  if (!customElements.get(tag)) {
    customElements.define(tag, ComponentClass);
  }

  const container = document.createElement('div');
  document.body.appendChild(container);

  const component = document.createElement(tag);

  // Setup before adding to DOM
  if (setup) {
    setup(component);
  }

  container.appendChild(component);

  // Wait for render if requested
  if (autoRender) {
    await component.rendered;
    await flushEffects();
  }

  const cleanup = () => {
    container.remove();
  };

  return { component, container, cleanup };
}

/**
 * Creates a simple test container with automatic cleanup
 * @returns {{container, cleanup}}
 */
export function createTestContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const cleanup = () => {
    container.remove();
  };

  return { container, cleanup };
}

/**
 * Asserts that reactive state updates trigger DOM updates
 * @param {HTMLElement} component - Component instance
 * @param {Function} stateUpdate - Function that updates state
 * @param {Function} domAssertion - Function that asserts DOM state
 */
export async function assertReactiveUpdate(component, stateUpdate, domAssertion) {
  // Update state
  stateUpdate();
  await flushEffects();

  // Assert DOM updated
  const result = domAssertion();
  return result;
}

/**
 * Asserts that an attribute binding works correctly
 * @param {HTMLElement} element - DOM element to check
 * @param {string} attrName - Attribute name
 * @param {*} expectedValue - Expected attribute value
 */
export function assertAttribute(element, attrName, expectedValue) {
  const actualValue = element.getAttribute(attrName);
  return actualValue === String(expectedValue);
}

/**
 * Asserts that a class list contains expected classes
 * @param {HTMLElement} element - DOM element to check
 * @param {string|string[]} expectedClasses - Expected class(es)
 */
export function assertClasses(element, expectedClasses) {
  const classes = Array.isArray(expectedClasses) ? expectedClasses : [expectedClasses];
  return classes.every(cls => element.classList.contains(cls));
}

/**
 * Waits for a condition to be true with timeout
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Timeout in ms (default: 1000)
 * @param {number} interval - Check interval in ms (default: 50)
 */
export async function waitFor(condition, timeout = 1000, interval = 50) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Creates a spy function for tracking calls
 * @returns {{fn: Function, calls: Array, called: boolean, callCount: number}}
 */
export function createSpy() {
  const spy = {
    calls: [],
    get called() { return this.calls.length > 0; },
    get callCount() { return this.calls.length; },
    reset() { this.calls = []; }
  };

  spy.fn = function(...args) {
    spy.calls.push(args);
    return args;
  };

  return spy;
}

/**
 * Captures console output for testing
 * @param {Function} fn - Function to run while capturing
 * @param {string} method - Console method to capture (log, warn, error)
 * @returns {Promise<string[]>} Array of captured messages
 */
export async function captureConsole(fn, method = 'error') {
  const messages = [];
  const original = console[method];

  console[method] = (...args) => {
    messages.push(args.join(' '));
  };

  try {
    await fn();
  } finally {
    console[method] = original;
  }

  return messages;
}

/**
 * Creates a mock Model for testing
 * @param {Object} data - Model data
 * @returns {Object} Mock model instance
 */
export function createMockModel(data = {}) {
  return {
    id: data.id || 'mock-id',
    ...data,
    hasValue(prop) {
      return prop ? this[prop] !== undefined : Object.keys(this).length > 1;
    },
    get(prop) {
      return this[prop];
    }
  };
}

/**
 * Runs a test with automatic cleanup
 * @param {Function} testFn - Test function
 */
export async function withCleanup(testFn) {
  const cleanups = [];

  const registerCleanup = (fn) => {
    cleanups.push(fn);
  };

  try {
    await testFn(registerCleanup);
  } finally {
    // Run cleanups in reverse order
    for (let i = cleanups.length - 1; i >= 0; i--) {
      try {
        await cleanups[i]();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
  }
}

/**
 * Waits for async condition with better error messages
 * Improved version that handles promises and flushes effects
 * @param {Function} condition - Function that returns boolean or Promise<boolean>
 * @param {Object} options - Configuration
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @param {number} options.interval - Check interval in ms (default: 50)
 * @param {string} options.message - Error message to show on timeout
 * @returns {Promise<void>}
 */
export async function waitForCondition(condition, options = {}) {
  const {
    timeout = 5000,
    interval = 50,
    message = 'Condition was not met'
  } = options;

  const startTime = Date.now();
  let lastError = null;

  while (Date.now() - startTime < timeout) {
    try {
      await flushEffects(); // Always flush effects before checking
      const result = await Promise.resolve(condition());
      if (result) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  const elapsed = Date.now() - startTime;
  const errorMsg = `${message} (waited ${elapsed}ms)${lastError ? ': ' + lastError.message : ''}`;
  throw new Error(errorMsg);
}

/**
 * Polls for a value to equal expected
 * @param {Function} getter - Function that returns current value
 * @param {*} expected - Expected value
 * @param {Object} options - Same as waitForCondition
 */
export async function waitForValue(getter, expected, options = {}) {
  await waitForCondition(
    () => getter() === expected,
    {
      ...options,
      message: options.message || `Expected value to be ${expected}, but got ${getter()}`
    }
  );
}

/**
 * Clears Model cache for test isolation
 * Should be called before/after tests that use Models
 */
export function clearModelCache() {
  if (Model.cache) {
    Model.cache.clear();
  }
}

/**
 * Creates isolated test environment with automatic cleanup
 * Clears Model cache, customElements registry tracking, etc.
 */
export async function withIsolation(testFn) {
  const registeredElements = new Set();
  const originalDefine = customElements.define.bind(customElements);

  // Track custom elements
  customElements.define = function(name, constructor, options) {
    registeredElements.add(name);
    return originalDefine(name, constructor, options);
  };

  try {
    // Clear before test
    clearModelCache();

    await testFn();

  } finally {
    // Restore
    customElements.define = originalDefine;

    // Clear after test
    clearModelCache();

    // Note: We can't unregister custom elements, but we track them for debugging
    if (registeredElements.size > 0) {
      // In a real scenario, we'd need to reload the page or use a different strategy
      // For now, just clear the cache
    }
  }
}

/**
 * Generates unique ID for tests
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
export function generateTestId(prefix = 'd:test') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Retry operation with exponential backoff
 * @param {Function} operation - Async operation to retry
 * @param {Object} options - Configuration
 * @param {number} options.maxRetries - Max retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 100)
 * @param {number} options.maxDelay - Max delay in ms (default: 5000)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 */
export async function retry(operation, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    shouldRetry = () => true
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError;
}

