export default class WeakCache {
  static name = 'WeakCache';

  #map = new Map();

  get (key) {
    if (this.#map.has(key)) {
      const cachedRef = this.#map.get(key);
      const cached = cachedRef.deref();
      if (cached) {
        return cached;
      } else {
        this.#map.delete(key);
      }
    }
  }

  set (key, value) {
    this.#map.set(key, new WeakRef(value));
  }

  delete (key) {
    this.#map.delete(key);
  }
}
