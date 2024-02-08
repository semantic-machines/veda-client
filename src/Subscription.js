import defaults from './defaults.js';

import WebSocket from 'ws';
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

import {timeout} from './Util.js';

export default class Subscription {
  static #instance;

  #address;
  #socket;
  #buffer = [];
  #subscriptions = new Map();
  #registry = new FinalizationRegistry((id) => {
    this.unsubscribe(id);
  });

  constructor (address = defaults.ccus) {
    if (Subscription.#instance) return Subscription.#instance;

    Subscription.#instance = this;
    this.#address = address;
    this.#connect();
  }

  async #connect (event) {
    if (event) {
      console.log(`Socket: ${event.type}, will re-connect in 30 sec.`);
      await timeout(30_000);
    }
    const socket = new WebSocket(this.#address);
    this.#socket = socket;
    socket.onopen = (event) => console.log(`Socket: ${event.type}`) && this.#send();
    socket.onclose = this.#connect.bind(this);
    socket.onerror = (event) => console.error(event.message);
    socket.onmessage = this.#receive.bind(this);
  }

  async #send (msg) {
    if (msg) this.#buffer.push(msg);
    await timeout(500);
    if (this.#socket.readyState === 1) {
      const msg = this.#buffer.join(',');
      if (msg) {
        this.#socket.send(msg);
        this.#buffer.length = 0;
      }
    } else {
      this.#send();
    }
  }

  #receive ({data: msg}) {
    if (msg === '') return;
    const ids = (msg.indexOf('=') === 0 ? msg.substr(1) : msg).split(',');
    for (const pairStr of ids) {
      const pair = pairStr.split('=');
      const [id, updateCounter] = pair;
      const subscription = this.#subscriptions.get(id);
      if (!subscription) {
        this.unsubscribe(id);
      } else {
        const [callback] = subscription.slice(-1);
        callback(id, Number(updateCounter));
      }
    }
  }

  subscribe (ref, subscription) {
    const [id, updateCounter] = subscription;
    if (this.#subscriptions.has(id)) return;
    this.#subscriptions.set(id, subscription);
    this.#registry.register(ref, id);
    this.#send(`+${id}=${updateCounter || 0}`);
  }

  unsubscribe (id) {
    if (!this.#subscriptions.has(id)) return;
    this.#subscriptions.delete(id);
    this.#send(`-${id}`);
  }
}
