/**
 * LinkedOM setup for testing Web Components in Node.js
 * This file sets up a global DOM environment for all tests
 *
 * LinkedOM is faster and lighter than JSDOM
 */

import { parseHTML } from 'linkedom';

// Create DOM from LinkedOM
const {
  window,
  document,
  customElements,
  HTMLElement,
  DocumentFragment,
  Node,
  Element,
  Text,
  Comment
} = parseHTML('<!DOCTYPE html><html><body></body></html>');

// Set global variables
global.window = window;
global.document = document;
global.HTMLElement = HTMLElement;
global.customElements = customElements;
global.DocumentFragment = DocumentFragment;
global.Node = Node;
global.Element = Element;
global.Text = Text;
global.Comment = Comment;

// Don't override Event/CustomEvent - let Node.js handle them for WebSocket compatibility

// Add PopStateEvent for Router
if (!global.PopStateEvent) {
  global.PopStateEvent = class PopStateEvent extends Event {
    constructor(type, eventInitDict = {}) {
      super(type, eventInitDict);
      this.state = eventInitDict.state || null;
    }
  };
}

// Add location and history mocks for Router tests
if (!global.window.location) {
  global.window.location = {
    href: 'http://localhost/',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    hash: '',
    pathname: '/',
    search: ''
  };
  global.location = global.window.location;
}

if (!global.window.history) {
  global.window.history = {
    pushState: () => {},
    replaceState: () => {},
    back: () => {},
    forward: () => {},
    go: () => {}
  };
  global.history = global.window.history;
}

// Additional globals that might be needed
if (!global.navigator) {
  global.navigator = {
    userAgent: 'Node.js'
  };
}

// requestAnimationFrame mock
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 0);
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Export for potential direct usage
export { window, document, customElements };

