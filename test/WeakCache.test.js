import WeakCache from '../src/WeakCache.js';
import {timeout} from '../src/Util.js';

const cache = new WeakCache();

export default ({test, assert}) => {
  test('WeakCache', async () => {
    const obj = {};

    cache.set(0, obj);

    let cached = cache.get(0);

    assert(obj === cached);

    cache.delete(0);

    cached = cache.get(0);

    assert(typeof cached === 'undefined');

    cache.set(0, obj);
  });

  test('WeakCache', async () => {
    await timeout();

    globalThis.gc();

    const cached = cache.get(0);

    assert(typeof cached === 'undefined');
  });
};
