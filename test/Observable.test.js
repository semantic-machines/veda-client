import Observable from '../src/Observable.js';
import Emitter from '../src/Emitter.js';

const ObservableObject = Observable(Emitter(Object));

export default ({test, assert}) => {
  test('Observable', async () => {
    const o = new ObservableObject();

    let payload;

    const handler = (...args) => {
      [payload] = args;
    };

    o.on('e', handler);
    o.trigger('e', 1);
    assert(payload === 1);

    o.emit('e', 2);
    assert(payload === 2);

    o.off('e', handler);
    o.emit('e', 3);
    assert(payload === 2);

    o.once('e', handler);
    o.emit('e', 4);
    assert(payload === 4);

    o.emit('e', 5);
    assert(payload === 4);

    o.on('e', handler);
    o.trigger('e', 6);
    assert(payload === 6);

    o.off('e');
    o.trigger('e', 7);
    assert(payload === 6);

    o.on('e', handler);
    o.trigger('e', 8);
    assert(payload === 8);

    o.off('*');
    o.trigger('e', 9);
    assert(payload === 8);

    let type;
    const handler1 = (...args) => {
      [type, payload] = args;
    };

    o.on('e f', handler1);
    o.trigger('e', 10);
    assert(type === 'e');
    assert(payload === 10);
  });
};
