import Observable from './Observable.js';

export default ({test, assert}) => {
  test('Observable', async () => {
    const o = new Observable();

    let payload;

    const handler = (...args) => {
      [payload] = args;
    };

    o.on('e', handler);
    await o.trigger('e', 1);
    assert(payload === 1);

    await o.emit('e', 2);
    assert(payload === 2);

    o.off('e', handler);
    await o.emit('e', 3);
    assert(payload === 2);

    o.once('e', handler);
    await o.emit('e', 4);
    assert(payload === 4);

    await o.emit('e', 5);
    assert(payload === 4);

    o.on('e', handler);
    await o.trigger('e', 6);
    assert(payload === 6);

    o.off('e');
    await o.trigger('e', 7);
    assert(payload === 6);

    o.on('e', handler);
    await o.trigger('e', 8);
    assert(payload === 8);

    o.off('*');
    await o.trigger('e', 9);
    assert(payload === 8);

    let type;
    const handler1 = (...args) => {
      [type, payload] = args;
    };

    o.on('e f', handler1);
    await o.trigger('e', 10);
    assert(type === 'e');
    assert(payload === 10);
  });
};
