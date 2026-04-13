export default class WeakCache {
  #map = new Map();

  #registry = new FinalizationRegistry((key) => {
    const entry = this.#map.get(key);
    if (!entry) return;
    if (entry.weakRef.deref() === undefined) {
      this.#map.delete(key);
    }
  });

  get (key) {
    const entry = this.#map.get(key);
    if (!entry) return;

    const cached = entry.weakRef.deref();
    if (cached) {
      return cached;
    }

    this.#registry.unregister(entry.unregisterToken);
    this.#map.delete(key);
  }

  set (key, value) {
    const prev = this.#map.get(key);
    if (prev) {
      this.#registry.unregister(prev.unregisterToken);
    }

    const weakRef = new WeakRef(value);
    const unregisterToken = {};
    this.#registry.register(value, key, unregisterToken);
    this.#map.set(key, {weakRef, unregisterToken});
  }

  delete (key) {
    const entry = this.#map.get(key);
    if (entry) {
      this.#registry.unregister(entry.unregisterToken);
    }
    this.#map.delete(key);
  }

  clear () {
    for (const entry of this.#map.values()) {
      this.#registry.unregister(entry.unregisterToken);
    }
    this.#map.clear();
  }

  _getSize () {
    return this.#map.size;
  }
}
