// Weak cache

export default class WeakCache {
  constructor () {
    this.storage = new Map();
  }

  get (key) {
    if (this.storage.has(key)) {
      const cachedRef = this.storage.get(key);
      const cached = cachedRef.deref();
      if (cached) {
        return cached;
      } else {
        this.storage.delete(key);
      }
    }
  }

  set (key, value) {
    this.storage.set(key, new WeakRef(value));
  }

  delete (key) {
    this.storage.delete(key);
  }
}
