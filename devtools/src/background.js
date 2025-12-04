/**
 * Background service worker for DevTools extension
 */

// Store connections to devtools panels
const connections = {};

// Listen for connections from DevTools panels
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

    // Handle messages from DevTools panel
    if (message.type === 'get-snapshot') {
      const requestTabId = message.tabId;
      if (!requestTabId) {
        console.warn('[Veda DevTools] No tabId in message');
        return;
      }

      // Request snapshot from content script
      chrome.tabs.sendMessage(requestTabId, { type: 'get-snapshot' }, function(response) {
        if (chrome.runtime.lastError) {
          console.warn('[Veda DevTools] Error getting snapshot:', chrome.runtime.lastError.message);
          port.postMessage({ event: 'snapshot', data: null });
        } else if (response) {
          // Response already has correct structure with event and data fields
          console.log('[Veda DevTools] Got snapshot response, forwarding to panel');
          port.postMessage(response);
        }
      });
    }

    // Handle highlight element request
    if (message.type === 'highlight-element') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, {
          type: 'highlight-element',
          componentId: message.componentId
        });
      }
    }

    // Handle hide highlight request
    if (message.type === 'hide-highlight') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, { type: 'hide-highlight' });
      }
    }

    // Handle inspect element request
    if (message.type === 'inspect-element') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, {
          type: 'inspect-element',
          componentId: message.componentId
        });
      }
    }

    // Handle scroll to element request
    if (message.type === 'scroll-to-element') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, {
          type: 'scroll-to-element',
          componentId: message.componentId
        });
      }
    }

    // Handle profiling commands
    if (message.type === 'start-profiling') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, { type: 'start-profiling' });
      }
    }

    if (message.type === 'stop-profiling') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, { type: 'stop-profiling' });
      }
    }

    // Handle state editing
    if (message.type === 'set-component-state') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, {
          type: 'set-component-state',
          componentId: message.componentId,
          key: message.key,
          value: message.value
        });
      }
    }

    // Handle profiling start
    if (message.type === 'start-profiling') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, { type: 'start-profiling' });
      }
    }

    // Handle profiling stop
    if (message.type === 'stop-profiling') {
      const requestTabId = message.tabId;
      if (requestTabId) {
        chrome.tabs.sendMessage(requestTabId, { type: 'stop-profiling' });
      }
    }
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(function(message, sender) {
  console.log('[Veda DevTools] Message from content script:', JSON.stringify(message));

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

