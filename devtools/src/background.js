/**
 * Background service worker for DevTools extension
 */

import { MessageRouter } from './MessageRouter.js';

// Store connections to devtools panels
const connections = {};

// Create message router
const router = new MessageRouter();

// ============================================================================
// Message Handlers
// ============================================================================

router.register('get-snapshot', (message, { tabId, port }) => {
  if (!tabId) {
    console.warn('[Veda DevTools] No tabId in get-snapshot message');
    return;
  }

  chrome.tabs.sendMessage(tabId, { type: 'get-snapshot' }, function(response) {
    if (chrome.runtime.lastError) {
      console.warn('[Veda DevTools] Error getting snapshot:', chrome.runtime.lastError.message);
      port.postMessage({ event: 'snapshot', data: null });
    } else if (response) {
      console.log('[Veda DevTools] Got snapshot response, forwarding to panel');
      port.postMessage(response);
    }
  });
});

router.register('highlight-element', (message, { tabId }) => {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: 'highlight-element',
      componentId: message.componentId
    });
  }
});

router.register('hide-highlight', (message, { tabId }) => {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'hide-highlight' });
  }
});

router.register('inspect-element', (message, { tabId }) => {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: 'inspect-element',
      componentId: message.componentId
    });
  }
});

router.register('scroll-to-element', (message, { tabId }) => {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: 'scroll-to-element',
      componentId: message.componentId
    });
  }
});

router.register('start-profiling', (message, { tabId }) => {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'start-profiling' });
  }
});

router.register('stop-profiling', (message, { tabId }) => {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'stop-profiling' });
  }
});

function editResult(port, message, ok, error) {
  if (!port) return;
  port.postMessage({
    event: 'edit-model-result',
    requestId: message.requestId,
    predicate: message.predicate,
    ok,
    error: ok ? '' : (error || 'Save failed')
  });
}

router.register('edit-model', (message, { tabId, port }) => {
  if (!tabId) {
    editResult(port, message, false, 'No inspected tab');
    return;
  }
  const payload = {
    type: 'edit-model',
    requestId: message.requestId,
    id: message.id,
    op: message.op,
    predicate: message.predicate
  };
  if (message.index != null) payload.index = message.index;
  if (message.value != null) payload.value = message.value;
  chrome.tabs.sendMessage(tabId, payload, function(response) {
    if (chrome.runtime.lastError) {
      editResult(port, message, false, chrome.runtime.lastError.message);
      return;
    }
    editResult(port, message, !!response?.ok, response?.error || 'No response from the page');
  });
});

router.register('set-component-state', (message, { tabId }) => {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: 'set-component-state',
      componentId: message.componentId,
      key: message.key,
      value: message.value
    });
  }
});

router.register('clear', (message, { tabId }) => {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'clear' });
  }
});

// ============================================================================
// Connection Handling
// ============================================================================

chrome.runtime.onConnect.addListener(function(port) {
  if (port.name !== 'devtools') return;

  console.log('[Veda DevTools] Panel connected');

  let tabId = null;

  port.onDisconnect.addListener(function() {
    console.log('[Veda DevTools] Panel disconnected');
    // Hide highlight when panel closes
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'hide-highlight' }).catch(() => {});
      delete connections[tabId];
    }
  });

  port.onMessage.addListener(function(message) {
    // Store connection on init
    if (message.type === 'init' && message.tabId) {
      tabId = message.tabId;
      connections[tabId] = port;
      console.log('[Veda DevTools] Panel initialized for tab', tabId);
      return;
    }

    // Route message to appropriate handler
    const handled = router.handle(message, { tabId, port });

    if (!handled) {
      console.warn('[Veda DevTools] Unhandled message type:', message.type);
    }
  });
});

// ============================================================================
// Content Script Messages
// ============================================================================

chrome.runtime.onMessage.addListener(function(message, sender) {
  console.log('[Veda DevTools] Message from content script:', message.event || message.type);

  if (message.source !== 'veda-devtools-content') return;

  // Check if sender and tab exist
  if (!sender || !sender.tab || !sender.tab.id) {
    console.warn('[Veda DevTools] No tab info in sender');
    return;
  }

  const tabId = sender.tab.id;
  const port = connections[tabId];

  if (port) {
    console.log('[Veda DevTools] Forwarding to panel. Event:', message.event, 'Has data:', !!message.data);
    // Forward event to DevTools panel
    port.postMessage({
      event: message.event,
      data: message.data
    });
  }
});

console.log('[Veda DevTools] Background script loaded');
