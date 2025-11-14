/**
 * Test helpers for reducing boilerplate code
 */

import { flushEffects } from '../src/Effect.js';

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
  // Initial assertion (optional - can be skipped if not needed)
  const initialCheck = domAssertion();
  
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

