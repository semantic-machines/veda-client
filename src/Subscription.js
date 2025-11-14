import ImportedWebSocket from 'ws';

/* c8 ignore next 3 - WebSocket polyfill fallback for Node.js */
if (!globalThis.WebSocket) {
  globalThis.WebSocket = ImportedWebSocket;
}

import {timeout} from './Util.js';

export default class Subscription {
  // Internal state (use _ prefix to indicate internal API)
  static _address = (() => {
    if (typeof location !== 'undefined') {
      /* c8 ignore next 3 - HTTPS protocol only in production browser */
      if (location.protocol === 'https:') {
        return `wss://${location.host}`;
      }
      /* c8 ignore next - Browser environment: location.port check */
      return location.port ? `ws://${location.hostname}:8088` : `ws://${location.host}`;
    }
    /* c8 ignore next - Default fallback (covered by Subscription.init in tests) */
    return 'ws://localhost:8088';
  })();
  static _socket;
  static _buffer = [];
  static _subscriptions = new Map();
  static _registry = new FinalizationRegistry((id) => {
    Subscription.unsubscribe(id);
  });

  // Injectable WebSocket class for testing
  static _WebSocketClass = null;

  static init (address = this._address, WebSocketClass = null) {
    Subscription._address = address;
    Subscription._WebSocketClass = WebSocketClass;
    Subscription._connect();
  }

  static async _connect (event) {
    /* c8 ignore next 4 - Reconnection delay: 30s timeout + logging (not testable in unit tests) */
    if (event) {
      console.log(`Socket: ${event.type}, will re-connect in 30 sec.`);
      await timeout(30_000);
    }
    /* c8 ignore next - Fallback to globalThis.WebSocket in production */
    const WS = Subscription._WebSocketClass || globalThis.WebSocket;
    const socket = new WS(Subscription._address);
    Subscription._socket = socket;
    /* c8 ignore next - Production callback: console.log && side-effect */
    socket.onopen = (event) => console.log(`Socket: ${event.type}`) && Subscription._send();
    socket.onclose = Subscription._connect;
    /* c8 ignore next - Production error logging */
    socket.onerror = (event) => console.error(event.message);
    socket.onmessage = Subscription._receive;
  }

  static async _send (msg) {
    if (msg) Subscription._buffer.push(msg);
    await timeout(500);
    if (Subscription._socket && Subscription._socket.readyState === 1) {
      const msg = Subscription._buffer.join(',');
      if (msg) {
        Subscription._socket.send(msg);
        Subscription._buffer.length = 0;
      }
    /* c8 ignore start - Retry send when socket not ready (covered by integration tests) */
    } else {
      Subscription._send();
    }
    /* c8 ignore stop */
  }

  static _receive ({data: msg}) {
    if (msg === '') return;
    const ids = (msg.indexOf('=') === 0 ? msg.substr(1) : msg).split(',');
    for (const pairStr of ids) {
      const pair = pairStr.split('=');
      const [id, updateCounter] = pair;
      const subscription = Subscription._subscriptions.get(id);
      /* c8 ignore next 2 - Orphaned subscription cleanup (race condition) */
      if (!subscription) {
        Subscription.unsubscribe(id);
      } else {
        const [callback] = subscription.slice(-1);
        callback(id, Number(updateCounter));
      }
    }
  }

  static subscribe (ref, subscription) {
    const [id, updateCounter] = subscription;
    if (Subscription._subscriptions.has(id)) return;
    Subscription._subscriptions.set(id, subscription);
    Subscription._registry.register(ref, id);
    Subscription._send(`+${id}=${updateCounter || 0}`);
  }

  static unsubscribe (id) {
    if (!Subscription._subscriptions.has(id)) return;
    Subscription._subscriptions.delete(id);
    Subscription._send(`-${id}`);
  }

  static _getSubscriptionCount() {
    return Subscription._subscriptions.size;
  }
}
