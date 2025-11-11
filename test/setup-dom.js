/**
 * JSDOM setup for testing Web Components in Node.js
 * This file sets up a global DOM environment for all tests
 *
 * JSDOM provides a complete DOM implementation for comprehensive testing
 */

import { JSDOM } from 'jsdom';

// Create a JSDOM instance with full DOM support
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
  referrer: 'http://localhost/',
  contentType: 'text/html',
  includeNodeLocations: false,
  storageQuota: 10000000,
  pretendToBeVisual: true,
  resources: 'usable',
  runScripts: 'dangerously'
});

const { window } = dom;
const { document } = window;

// Save Node.js Event before overwriting (needed for WebSocket)
const NodeEvent = global.Event;

// Set global variables
global.window = window;
global.document = document;
global.HTMLElement = window.HTMLElement;
global.customElements = window.customElements;
global.DocumentFragment = window.DocumentFragment;
global.Node = window.Node;
global.Element = window.Element;
global.Text = window.Text;
global.Comment = window.Comment;
global.NodeFilter = window.NodeFilter;

// Events - use jsdom events for DOM, but keep Node.js Event for WebSocket
global.Event = window.Event;
global.CustomEvent = window.CustomEvent;
global.MouseEvent = window.MouseEvent;
global.KeyboardEvent = window.KeyboardEvent;
global.FocusEvent = window.FocusEvent;
global.InputEvent = window.InputEvent;

// Restore Node.js Event for WebSocket compatibility
// WebSocket needs the original Node.js Event class, not jsdom's
if (NodeEvent) {
  global.Event = NodeEvent;
}

// Other important globals
// Note: navigator, location, history are read-only in jsdom, use window.* directly
if (!global.navigator) {
  Object.defineProperty(global, 'navigator', {
    value: window.navigator,
    writable: false,
    configurable: true
  });
}
if (!global.location) {
  Object.defineProperty(global, 'location', {
    value: window.location,
    writable: false,
    configurable: true
  });
}
if (!global.history) {
  Object.defineProperty(global, 'history', {
    value: window.history,
    writable: false,
    configurable: true
  });
}

global.requestAnimationFrame = window.requestAnimationFrame;
global.cancelAnimationFrame = window.cancelAnimationFrame;
global.MutationObserver = window.MutationObserver;
global.ResizeObserver = window.ResizeObserver || class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Add PopStateEvent for Router (should already be in jsdom, but just in case)
global.PopStateEvent = window.PopStateEvent || class PopStateEvent extends Event {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.state = eventInitDict.state || null;
  }
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (args.length > 0) {
    const firstArg = String(args[0]);

    // Suppress expected test errors
    if (firstArg.includes('Infinite loop detected') ||
        firstArg.includes('TypeError: Cannot read properties of undefined')) {
      return;
    }
  }

  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (args.length > 0) {
    const message = String(args[0]);

    // Suppress expected warnings from tests
    if (message.includes('Invalid expression')) {
      return;
    }
  }

  originalConsoleWarn(...args);
};

const originalConsoleLog = console.log;
console.log = (...args) => {
  // Filter out component error dumps (Component.js logs errors via console.log)
  if (args.length >= 2) {
    const secondArg = String(args[1]);
    if (secondArg.includes('Component render error') ||
        secondArg.includes('Component remove error')) {
      return;
    }
  }

  originalConsoleLog(...args);
};

// Export for potential direct usage
export { window, document };
