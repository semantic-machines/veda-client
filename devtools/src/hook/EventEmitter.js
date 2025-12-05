/**
 * Event Emitter
 * Simple event emitter for hook events
 */

export class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    if (!callback) {
      delete this.listeners[event];
    } else {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    const eventListeners = this.listeners[event];
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
}
