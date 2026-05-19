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
      return location.port ? `ws://${location.hostname}:8088` : `ws://${location.host}`;
    }
    return 'ws://localhost:8088';
  })();
  static _socket;
  static _buffer = [];
  static _subscriptions = new Map();
  static _refCounts = new Map();
  static _refEntries = new WeakMap();
  static _registry = new FinalizationRegistry((id) => {
    Subscription._decrement(id);
  });

  // Injectable WebSocket class for testing
  static _WebSocketClass = null;

  static init (address = this._address, WebSocketClass = null) {
    Subscription._address = address;
    Subscription._WebSocketClass = WebSocketClass;
    Subscription._connect();
  }

  static async _connect (event) {
    if (event) {
      console.log(`Socket: ${event.type}, will re-connect in 30 sec.`);
      await timeout(30_000);
    }
    const WS = Subscription._WebSocketClass || globalThis.WebSocket;
    const socket = new WS(Subscription._address);
    Subscription._socket = socket;
    socket.onopen = () => Subscription._send();
    socket.onclose = Subscription._connect;
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
    } else {
      Subscription._send();
    }
  }

  static _receive ({data: msg}) {
    if (msg === '') return;
    const ids = (msg.indexOf('=') === 0 ? msg.substr(1) : msg).split(',');
    for (const pairStr of ids) {
      const pair = pairStr.split('=');
      const [id, updateCounter] = pair;
      const subscription = Subscription._subscriptions.get(id);
      if (!subscription) {
        Subscription._drop(id);
      } else {
        const callback = subscription[2];
        callback(id, Number(updateCounter));
      }
    }
  }

  /**
   * Register interest in server updates for an individual.
   * @param {object} ref - Holder kept alive while subscribed (typically a Component).
   *   FinalizationRegistry decrements when ref is GC'd unless release() was called first.
   */
  static subscribe (ref, subscription) {
    const [id, updateCounter] = subscription;
    if (Subscription._refEntries.has(ref)) return;

    const count = Subscription._refCounts.get(id) || 0;
    Subscription._refCounts.set(id, count + 1);

    const token = {};
    Subscription._refEntries.set(ref, { id, token });
    Subscription._registry.register(ref, id, token);

    if (count === 0) {
      Subscription._subscriptions.set(id, subscription);
      Subscription._send(`+${id}=${updateCounter || 0}`);
    }
  }

  /**
   * Release one holder registered via subscribe(ref, …).
   * Sends unsubscribe to the server when the last holder is released.
   */
  static release (ref) {
    const entry = Subscription._refEntries.get(ref);
    if (!entry) return;
    Subscription._refEntries.delete(ref);
    Subscription._registry.unregister(entry.token);
    Subscription._decrement(entry.id);
  }

  static _decrement (id) {
    const count = Subscription._refCounts.get(id);
    if (count == null) return;
    if (count <= 1) {
      Subscription._refCounts.delete(id);
      Subscription._drop(id);
    } else {
      Subscription._refCounts.set(id, count - 1);
    }
  }

  static _drop (id) {
    if (!Subscription._subscriptions.has(id)) return;
    Subscription._subscriptions.delete(id);
    Subscription._send(`-${id}`);
  }

  /** Force-unsubscribe regardless of holder count (Model.unsubscribe). */
  static unsubscribe (id) {
    Subscription._refCounts.delete(id);
    Subscription._drop(id);
  }

  static _getSubscriptionCount() {
    return Subscription._subscriptions.size;
  }

  static _getRefCount(id) {
    return Subscription._refCounts.get(id) || 0;
  }
}

// Expose for DevTools
if (typeof window !== 'undefined') {
  window.__VEDA_SUBSCRIPTION__ = Subscription;
}
