export default class WeakCache<K = any, V = any> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  delete(key: K): void;
  clear(): void;
  _getSize(): number;
}

