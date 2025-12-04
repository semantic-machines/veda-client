/**
 * Content script that injects the devtools hook into the page
 */

// Inject hook script into page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/hook.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from page
window.addEventListener('message', function(event) {
  // Only accept messages from same window
  if (event.source !== window) return;

  // Only accept messages from our hook
  if (event.data.source !== 'veda-devtools-hook') return;

  // Skip snapshot messages - they are handled separately via chrome.runtime.onMessage
  if (event.data.type === 'snapshot') return;

  // Forward real-time events to background script
  chrome.runtime.sendMessage({
    source: 'veda-devtools-content',
    event: event.data.event,
    data: event.data.data
  });
});

// Listen for requests from background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.type === 'get-snapshot') {
    // Request snapshot from hook
    window.postMessage({
      source: 'veda-devtools-request',
      type: 'get-snapshot'
    }, '*');

    // Listen for response
    const listener = function(event) {
      if (event.data.source === 'veda-devtools-hook' && event.data.type === 'snapshot') {
        window.removeEventListener('message', listener);
        // Send back with proper structure including event field
        sendResponse({
          source: 'veda-devtools-content',
          event: 'snapshot',
          data: event.data.data
        });
      }
    };
    window.addEventListener('message', listener);

    // Timeout after 1 second
    setTimeout(() => {
      window.removeEventListener('message', listener);
    }, 1000);

    return true; // Keep channel open for async response
  }

  // Handle highlight element request
  if (message.type === 'highlight-element') {
    window.postMessage({
      source: 'veda-devtools-request',
      type: 'highlight-element',
      componentId: message.componentId
    }, '*');
    sendResponse({ success: true });
    return false;
  }

  // Handle hide highlight request
  if (message.type === 'hide-highlight') {
    window.postMessage({
      source: 'veda-devtools-request',
      type: 'hide-highlight'
    }, '*');
    sendResponse({ success: true });
    return false;
  }

  // Handle inspect element request
  if (message.type === 'inspect-element') {
    window.postMessage({
      source: 'veda-devtools-request',
      type: 'inspect-element',
      componentId: message.componentId
    }, '*');
    sendResponse({ success: true });
    return false;
  }

  // Handle scroll to element request
  if (message.type === 'scroll-to-element') {
    window.postMessage({
      source: 'veda-devtools-request',
      type: 'scroll-to-element',
      componentId: message.componentId
    }, '*');
    sendResponse({ success: true });
    return false;
  }

  // Handle state editing
  if (message.type === 'set-component-state') {
    window.postMessage({
      source: 'veda-devtools-request',
      type: 'set-component-state',
      componentId: message.componentId,
      key: message.key,
      value: message.value
    }, '*');
    sendResponse({ success: true });
    return false;
  }

  // Handle profiling start
  if (message.type === 'start-profiling') {
    window.postMessage({
      source: 'veda-devtools-request',
      type: 'start-profiling'
    }, '*');
    sendResponse({ success: true });
    return false;
  }

  // Handle profiling stop
  if (message.type === 'stop-profiling') {
    window.postMessage({
      source: 'veda-devtools-request',
      type: 'stop-profiling'
    }, '*');

    // Listen for profiling result
    const listener = function(event) {
      if (event.data.source === 'veda-devtools-hook' && event.data.type === 'profiling-result') {
        window.removeEventListener('message', listener);
        chrome.runtime.sendMessage({
          source: 'veda-devtools-content',
          event: 'profiling-result',
          data: event.data.data
        });
      }
    };
    window.addEventListener('message', listener);
    setTimeout(() => window.removeEventListener('message', listener), 5000);
    return false;
  }
});

