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

// Export for potential direct usage
export { window, document };
