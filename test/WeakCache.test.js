import WeakCache from '../src/WeakCache.js';
import {timeout} from '../src/Util.js';

const cache = new WeakCache();

export default ({test, assert}) => {
  test('WeakCache - базовый функционал', async () => {
    const obj = {};

    cache.set(0, obj);

    let cached = cache.get(0);

    assert(obj === cached);

    cache.delete(0);

    cached = cache.get(0);

    assert(typeof cached === 'undefined');

    cache.set(0, obj);
  });

  test('WeakCache - очистка по GC', async () => {
    await timeout();

    globalThis.gc();

    const cached = cache.get(0);

    assert(typeof cached === 'undefined');
  });

  test('WeakCache - clear', () => {
    const obj1 = {};
    const obj2 = {};

    cache.set('key1', obj1);
    cache.set('key2', obj2);

    assert(cache.get('key1') === obj1);
    assert(cache.get('key2') === obj2);

    cache.clear();

    assert(cache.get('key1') === undefined);
    assert(cache.get('key2') === undefined);
  });

  test('WeakCache - _getSize', () => {
    const cache2 = new WeakCache();

    assert(cache2._getSize() === 0);

    cache2.set('a', {});
    cache2.set('b', {});
    cache2.set('c', {});

    assert(cache2._getSize() === 3);

    cache2.delete('b');
    assert(cache2._getSize() === 2);

    cache2.clear();
    assert(cache2._getSize() === 0);
  });
};
