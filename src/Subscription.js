import defaults from './defaults.js';

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

    this.#address = address;
    this.#connect();
    Subscription.#instance = this;
  }

  async #connect (event) {
    if (event) await timeout(30_000);
    const socket = new WebSocket(this.#address);
    socket.onopen = this.#send.bind(this);
    socket.onclose = this.#connect.bind(this);
    socket.onerror = this.#connect.bind(this);
    socket.onmessage = this.#receive.bind(this);
    this.#socket = socket;
  }

  async #send () {
    if (this.#buffer.length && this.#socket.readyState === 1) {
      this.#socket.send(this.#buffer.join(','));
      this.#buffer.length = 0;
    }
    await timeout(1000);
    this.#send();
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
    this.#buffer.push(`+${id}=${updateCounter || 0}`);
  }

  unsubscribe (id) {
    this.#subscriptions.delete(id);
    this.#buffer.push(`-${id}`);
  }
}
