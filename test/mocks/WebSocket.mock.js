/**
 * Mock WebSocket for testing
 * Simulates WebSocket behavior without real network connection
 */

export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    this.sentMessages = [];
    this._subscribers = new Map();

    // Auto-open after short delay to simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({ type: 'open', target: this });
      }
    }, 10);
  }

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);

    // Parse subscription commands and auto-respond
    this._handleSubscriptionCommand(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({ type: 'close', target: this });
      }
    }, 10);
  }

  // Test helper: simulate receiving a message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({
        type: 'message',
        data: data,
        target: this
      });
    }
  }

  // Test helper: simulate error
  simulateError(error) {
    if (this.onerror) {
      this.onerror({
        type: 'error',
        message: error,
        target: this
      });
    }
  }

  // Test helper: simulate close
  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ type: 'close', target: this });
    }
  }

  // Parse subscription commands and store them
  _handleSubscriptionCommand(data) {
    // Command format: "+id=counter" for subscribe, "-id" for unsubscribe
    const commands = data.split(',');

    commands.forEach(cmd => {
      if (cmd.startsWith('+')) {
        const [id, counter] = cmd.substring(1).split('=');
        this._subscribers.set(id, parseInt(counter) || 0);
      } else if (cmd.startsWith('-')) {
        const id = cmd.substring(1);
        this._subscribers.delete(id);
      }
    });
  }

  // Test helper: simulate subscription update
  simulateUpdate(id, counter) {
    if (this._subscribers.has(id)) {
      const message = `${id}=${counter}`;
      this.simulateMessage(message);
    }
  }

  // Test helper: get sent messages
  getSentMessages() {
    return [...this.sentMessages];
  }

  // Test helper: get active subscriptions
  getSubscriptions() {
    return new Map(this._subscribers);
  }

  // Test helper: clear sent messages
  clearMessages() {
    this.sentMessages = [];
  }
}

// Store original WebSocket
let originalWebSocket = null;

// Install mock globally
export function installMockWebSocket() {
  if (typeof globalThis.WebSocket !== 'undefined') {
    originalWebSocket = globalThis.WebSocket;
  }
  globalThis.WebSocket = MockWebSocket;
  return MockWebSocket;
}

// Restore original WebSocket
export function restoreMockWebSocket() {
  if (originalWebSocket) {
    globalThis.WebSocket = originalWebSocket;
    originalWebSocket = null;
  }
}

// Get current mock instance (if any)
export function getCurrentMockWebSocket() {
  // This is tricky - we need to track instances
  // For now, return the class for testing
  return MockWebSocket;
}

