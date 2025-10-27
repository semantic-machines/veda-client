import {reactive} from '../src/Reactive.js';
import {effect, flushEffects} from '../src/Effect.js';

export default ({test, assert}) => {
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
};

