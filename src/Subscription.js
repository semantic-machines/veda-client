import ImportedWebSocket from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ImportedWebSocket;
}

import {timeout} from './Util.js';

export default class Subscription {
  static #address = typeof location !== 'undefined'
  ? location.protocol === 'https:'
    ? `wss://${location.host}`
    : location.port
      ? `ws://${location.hostname}:8088`
      : `ws://${location.host}`
  : 'ws://localhost:8088';
  static #socket;
  static #buffer = [];
  static #subscriptions = new Map();
  static #registry = new FinalizationRegistry((id) => {
    Subscription.unsubscribe(id);
  });

  static init (address = this.#address) {
    Subscription.#address = address;
    Subscription.#connect();
  }

  static async #connect (event) {
    if (event) {
      console.log(`Socket: ${event.type}, will re-connect in 30 sec.`);
      await timeout(30_000);
    }
    const socket = new WebSocket(Subscription.#address);
    Subscription.#socket = socket;
    socket.onopen = (event) => console.log(`Socket: ${event.type}`) && Subscription.#send();
    socket.onclose = Subscription.#connect;
    socket.onerror = (event) => console.error(event.message);
    socket.onmessage = Subscription.#receive;
  }

  static async #send (msg) {
    if (msg) Subscription.#buffer.push(msg);
    await timeout(500);
    if (Subscription.#socket.readyState === 1) {
      const msg = Subscription.#buffer.join(',');
      if (msg) {
        Subscription.#socket.send(msg);
        Subscription.#buffer.length = 0;
      }
    } else {
      Subscription.#send();
    }
  }

  static #receive ({data: msg}) {
    if (msg === '') return;
    const ids = (msg.indexOf('=') === 0 ? msg.substr(1) : msg).split(',');
    for (const pairStr of ids) {
      const pair = pairStr.split('=');
      const [id, updateCounter] = pair;
      const subscription = Subscription.#subscriptions.get(id);
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
    if (Subscription.#subscriptions.has(id)) return;
    Subscription.#subscriptions.set(id, subscription);
    Subscription.#registry.register(ref, id);
    Subscription.#send(`+${id}=${updateCounter || 0}`);
  }

  static unsubscribe (id) {
    if (!Subscription.#subscriptions.has(id)) return;
    Subscription.#subscriptions.delete(id);
    Subscription.#send(`-${id}`);
  }
}
