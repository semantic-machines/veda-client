import {reactive} from '../src/Reactive.js';
import {effect, flushEffects, pauseTracking, resumeTracking, untrack} from '../src/Effect.js';

export default ({test, assert}) => {
  test('Reactive - return non-object as is', () => {
    // Test null
    const nullValue = reactive(null);
    assert(nullValue === null, 'null should be returned as is');

    // Test undefined
    const undefinedValue = reactive(undefined);
    assert(undefinedValue === undefined, 'undefined should be returned as is');

    // Test number
    const numValue = reactive(42);
    assert(numValue === 42, 'number should be returned as is');

    // Test string
    const strValue = reactive('hello');
    assert(strValue === 'hello', 'string should be returned as is');

    // Test boolean
    const boolValue = reactive(true);
    assert(boolValue === true, 'boolean should be returned as is');
  });

  test('Reactive - create reactive proxy', () => {
    const obj = reactive({count: 0});
    assert(obj.count === 0);
    assert(obj.__isReactive === true);
  });

  test('Reactive - trigger effects on property change', async () => {
    const obj = reactive({count: 0});
    let result = 0;

    effect(() => {
      result = obj.count * 2;
    });

    await flushEffects(); // Wait for initial effect
    assert(result === 0);

    obj.count = 5;
    await flushEffects(); // Wait for effect to run
    assert(result === 10);

    obj.count = 10;
    await flushEffects();
    assert(result === 20);
  });

  test('Reactive - handle nested reactive objects', async () => {
    const obj = reactive({
      nested: {value: 1}
    });

    let result = 0;
    effect(() => {
      result = obj.nested.value;
    });

    await flushEffects();
    assert(result === 1);

    obj.nested.value = 2;
    await flushEffects();
    assert(result === 2);
  });

  test('Reactive - not trigger on same value', async () => {
    const obj = reactive({count: 0});
    let runs = 0;

    effect(() => {
      obj.count; // Read
      runs++;
    });

    await flushEffects();
    assert(runs === 1);

    obj.count = 0; // Same value
    await flushEffects();
    assert(runs === 1); // Should not re-run
  });

  test('Reactive - handle multiple effects', async () => {
    const obj = reactive({count: 0});
    let result1 = 0;
    let result2 = 0;

    effect(() => {
      result1 = obj.count + 1;
    });

    effect(() => {
      result2 = obj.count * 2;
    });

    await flushEffects();
    assert(result1 === 1);
    assert(result2 === 0);

    obj.count = 5;
    await flushEffects();
    assert(result1 === 6);
    assert(result2 === 10);
  });

  test('Reactive - cleanup effect', async () => {
    const obj = reactive({count: 0});
    let result = 0;

    const cleanup = effect(() => {
      result = obj.count;
    });

    await flushEffects();
    assert(result === 0);

    obj.count = 5;
    await flushEffects();
    assert(result === 5);

    cleanup(); // Stop effect

    obj.count = 10;
    await flushEffects();
    assert(result === 5); // Should not update
  });

  test('Reactive - handle property deletion', async () => {
    const obj = reactive({count: 0, name: 'test'});
    let result = '';

    effect(() => {
      result = obj.name || 'empty';
    });

    await flushEffects();
    assert(result === 'test');

    delete obj.name;
    await flushEffects();
    assert(result === 'empty');
  });

  test('Reactive - track only accessed properties', async () => {
    const obj = reactive({a: 1, b: 2, c: 3});
    let result = 0;

    effect(() => {
      result = obj.a + obj.b; // Only track a and b
    });

    await flushEffects();
    assert(result === 3);

    obj.c = 10; // Should not trigger
    await flushEffects();
    assert(result === 3);

    obj.a = 5; // Should trigger
    await flushEffects();
    assert(result === 7);
  });

  test('Reactive - handle conditional tracking', async () => {
    const obj = reactive({show: true, a: 1, b: 2});
    let result = 0;

    effect(() => {
      result = obj.show ? obj.a : obj.b;
    });

    await flushEffects();
    assert(result === 1);

    obj.b = 10; // Should not trigger (b is not accessed)
    await flushEffects();
    assert(result === 1);

    obj.show = false; // Now tracks b
    await flushEffects();
    assert(result === 10);

    obj.b = 20; // Should trigger now
    await flushEffects();
    assert(result === 20);

    obj.a = 100; // Should not trigger (a is not accessed anymore)
    await flushEffects();
    assert(result === 20);
  });

  test('Reactive - handle array replacement', async () => {
    const obj = reactive({items: [1, 2, 3]});
    let sum = 0;

    effect(() => {
      sum = obj.items.reduce((a, b) => a + b, 0);
    });

    await flushEffects();
    assert(sum === 6);

    obj.items = [5, 5];
    await flushEffects();
    assert(sum === 10);

    obj.items = [1, 2, 3, 4];
    await flushEffects();
    assert(sum === 10);
  });

  test('Reactive - handle array mutations (push, pop)', async () => {
    const obj = reactive({items: [1, 2, 3]});
    let sum = 0;

    effect(() => {
      sum = obj.items.reduce((a, b) => a + b, 0);
    });

    await flushEffects();
    assert(sum === 6);

    obj.items.push(4);
    await flushEffects();
    assert(sum === 10);

    obj.items.pop();
    await flushEffects();
    assert(sum === 6);

    obj.items.unshift(0);
    await flushEffects();
    assert(sum === 6);

    obj.items.shift();
    await flushEffects();
    assert(sum === 6);
  });

  test('Reactive - handle array splice', async () => {
    const obj = reactive({items: [1, 2, 3, 4, 5]});
    let sum = 0;

    effect(() => {
      sum = obj.items.reduce((a, b) => a + b, 0);
    });

    await flushEffects();
    assert(sum === 15);

    obj.items.splice(2, 1); // Remove 3
    await flushEffects();
    assert(sum === 12);

    obj.items.splice(1, 0, 10); // Insert 10 at index 1
    await flushEffects();
    assert(sum === 22);
  });

  test('Effect - run immediately', async () => {
    let runs = 0;
    effect(() => {
      runs++;
    });
    await flushEffects();
    assert(runs === 1);
  });

  test('Effect - support lazy effects', () => {
    let runs = 0;
    const cleanup = effect(() => {
      runs++;
    }, {lazy: true});

    assert(runs === 0);

    // To run lazy effect, we need to call it differently
    // For now, just test that it didn't run immediately
    cleanup(); // cleanup
  });

  test('Effect - support scheduler', async () => {
    const obj = reactive({count: 0});
    const calls = [];

    effect(() => {
      calls.push(obj.count);
    }, {
      scheduler: (eff) => {
        calls.push('scheduled');
        eff();
      }
    });

    await flushEffects();
    assert(calls.length === 1 && calls[0] === 0); // Initial run

    obj.count = 1;
    await flushEffects();
    assert(calls.length === 3 && calls[0] === 0 && calls[1] === 'scheduled' && calls[2] === 1);
  });

  test('Reactive - handle array sort without changes', async () => {
    const obj = reactive({items: [1, 2, 3]});
    let runs = 0;

    effect(() => {
      obj.items.length; // Track array
      runs++;
    });

    await flushEffects();
    assert(runs === 1);

    // Sort already sorted array - should not trigger
    obj.items.sort();
    await flushEffects();
    assert(runs === 1, 'Should not trigger on unchanged sort');

    // Actual change should trigger
    obj.items.sort((a, b) => b - a);
    await flushEffects();
    assert(runs === 2, 'Should trigger on actual sort change');
  });

  test('Reactive - handle array reverse', async () => {
    const obj = reactive({items: [1, 2, 3]});
    let sum = 0;

    effect(() => {
      sum = obj.items.reduce((a, b) => a + b, 0);
    });

    await flushEffects();
    assert(sum === 6);

    obj.items.reverse();
    await flushEffects();
    assert(sum === 6); // Sum is same but order changed

    // Verify order actually changed by accessing items
    assert(obj.items[0] === 3);
    assert(obj.items[2] === 1);
  });

  test('Reactive - handle Date objects', async () => {
    const date = new Date();
    const obj = reactive({created: date});
    let result = null;

    effect(() => {
      result = obj.created;
    });

    await flushEffects();
    assert(result === date);
    assert(result instanceof Date, 'Date should not be wrapped');
  });

  test('Reactive - handle RegExp objects', async () => {
    const regex = /test/g;
    const obj = reactive({pattern: regex});
    let result = null;

    effect(() => {
      result = obj.pattern;
    });

    await flushEffects();
    assert(result === regex);
    assert(result instanceof RegExp, 'RegExp should not be wrapped');
  });

  test('Reactive - handle Promise objects', async () => {
    const promise = Promise.resolve(42);
    const obj = reactive({async: promise});
    let result = null;

    effect(() => {
      result = obj.async;
    });

    await flushEffects();
    assert(result === promise);
    assert(result instanceof Promise, 'Promise should not be wrapped');
  });

  test('Reactive - return same proxy for already reactive object', () => {
    const obj = {count: 0};
    const proxy1 = reactive(obj);
    const proxy2 = reactive(proxy1);

    assert(proxy1 === proxy2, 'Should return same proxy for reactive object');
  });

  test('Effect - pauseTracking and resumeTracking', async () => {
    const obj = reactive({a: 1, b: 2});
    let result = 0;

    effect(() => {
      result = obj.a;
      pauseTracking();
      // This read should not be tracked
      result += obj.b;
      resumeTracking();
    });

    await flushEffects();
    assert(result === 3);

    // Changing b should not trigger effect (not tracked)
    obj.b = 10;
    await flushEffects();
    assert(result === 3, 'Should not track obj.b');

    // Changing a should trigger effect
    obj.a = 5;
    await flushEffects();
    assert(result === 15); // 5 + 10
  });

  test('Effect - untrack function', async () => {
    const obj = reactive({a: 1, b: 2});
    let result = 0;

    effect(() => {
      result = obj.a;
      // This read should not be tracked
      untrack(() => {
        result += obj.b;
      });
    });

    await flushEffects();
    assert(result === 3);

    // Changing b should not trigger effect (not tracked)
    obj.b = 10;
    await flushEffects();
    assert(result === 3, 'Should not track obj.b inside untrack');

    // Changing a should trigger effect
    obj.a = 5;
    await flushEffects();
    assert(result === 15); // 5 + 10
  });

  test('Effect - untrack returns value', () => {
    const obj = reactive({count: 5});
    const result = untrack(() => {
      return obj.count * 2;
    });
    assert(result === 10, 'untrack should return function result');
  });
};

