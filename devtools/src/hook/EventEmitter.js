/**
 * Event Emitter Module
 * Simple event emitter for hook events
 */

export function createEventEmitter() {
  const listeners = {};

  return {
    on(event, callback) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    },

    off(event, callback) {
      if (!listeners[event]) return;
      if (!callback) {
        delete listeners[event];
      } else {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      }
    },

    emit(event, data) {
      const eventListeners = listeners[event];
      if (eventListeners) {
        eventListeners.forEach(cb => {
          try {
            cb(data);
          } catch (e) {
            console.warn('[Veda DevTools] Listener error:', e);
          }
        });
      }

      // Send to DevTools panel via postMessage
      window.postMessage({
        source: 'veda-devtools-hook',
        event,
        data
      }, '*');
    }
  };
}

