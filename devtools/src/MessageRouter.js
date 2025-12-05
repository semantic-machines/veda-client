/**
 * Message Router for background script
 * Handles different message types with registered handlers
 */

export class MessageRouter {
  constructor() {
    /** @type {Map<string, Function>} */
    this.handlers = new Map();
  }

  /**
   * Register a handler for a message type
   * @param {string} type - Message type
   * @param {Function} handler - Handler function (message, context) => void
   */
  register(type, handler) {
    this.handlers.set(type, handler);
  }

  /**
   * Handle incoming message
   * @param {Object} message - Message object with type field
   * @param {Object} context - Context object (tabId, port, etc)
   * @returns {boolean} True if handler was found and executed
   */
  handle(message, context) {
    const handler = this.handlers.get(message.type);
    if (handler) {
      handler(message, context);
      return true;
    }
    return false;
  }

  /**
   * Check if handler exists for type
   * @param {string} type
   * @returns {boolean}
   */
  has(type) {
    return this.handlers.has(type);
  }
}

