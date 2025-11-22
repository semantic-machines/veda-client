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
    if (tabId && connections[tabId]) {
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

