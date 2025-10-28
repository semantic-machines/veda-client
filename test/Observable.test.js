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

  test('Observable - set with symbol property', async () => {
    const o = new ObservableObject();
    const sym = Symbol('test');
    let emitCount = 0;

    o.on('modified', () => {
      emitCount++;
    });

    o[sym] = 'value';
    assert(o[sym] === 'value');
    assert(emitCount === 0, 'Symbol property should not emit modified');

    o.test = 'string';
    assert(emitCount === 1, 'String property should emit modified');
  });

  test('Observable - deleteProperty', async () => {
    const o = new ObservableObject();
    let deleteEmitted = false;
    let modifiedEmitted = false;

    o.test = 'value';

    o.on('test', () => {
      deleteEmitted = true;
    });

    o.on('modified', (key) => {
      if (key === 'test') {
        modifiedEmitted = true;
      }
    });

    delete o.test;

    assert(deleteEmitted, 'Should emit property-specific event on delete');
    assert(modifiedEmitted, 'Should emit modified event on delete');
    assert(!('test' in o), 'Property should be deleted');
  });

  test('Observable - deleteProperty with symbol', async () => {
    const o = new ObservableObject();
    const sym = Symbol('test');
    let emitCount = 0;

    o.on('modified', () => {
      emitCount++;
    });

    o[sym] = 'value';
    delete o[sym];

    assert(emitCount === 0, 'Symbol delete should not emit');
  });

  test('Observable - deleteProperty on non-existent key', async () => {
    const o = new ObservableObject();
    let emitCount = 0;

    o.on('modified', () => {
      emitCount++;
    });

    // Deleting non-existent key should not throw and should not emit
    const result = delete o.nonExistent;

    // Proxy deleteProperty trap must return true to indicate success
    assert(result === true, 'deleteProperty should return true');
    assert(emitCount === 0, 'Deleting non-existent key should not emit');
  });
};
