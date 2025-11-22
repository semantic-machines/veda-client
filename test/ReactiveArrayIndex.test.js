import {reactive} from '../src/Reactive.js';
import {effect, flushEffects} from '../src/Effect.js';

/**
 * Tests for array index reactivity
 * Array index assignment IS reactive when the effect reads that specific index
 */
export default ({test, assert}) => {
  test('Reactive - array index assignment IS reactive when tracked', async () => {
    const obj = reactive({ items: [1, 2, 3] });
    let triggered = 0;

    effect(() => {
      obj.items[0]; // Track specific index
      triggered++;
    });

    await flushEffects();
    assert(triggered === 1, 'Initial effect run');

    // ✅ This IS reactive when index is tracked
    obj.items[0] = 99;
    await flushEffects();
    assert(triggered === 2, 'Index assignment should trigger effect when tracked');
    assert(obj.items[0] === 99, 'Value is changed');

    // ✅ Multiple indices can be tracked independently
    obj.items[1] = 50;
    await flushEffects();
    assert(triggered === 2, 'Changing untracked index should NOT trigger');

    obj.items[0] = 100;
    await flushEffects();
    assert(triggered === 3, 'Changing tracked index should trigger');
  });

  test('Reactive - tracking length does NOT react to index changes', async () => {
    const obj = reactive({ items: [1, 2, 3] });
    let triggered = 0;

    effect(() => {
      obj.items.length; // Only track length
      triggered++;
    });

    await flushEffects();
    assert(triggered === 1);

    // Length doesn't change, so no trigger
    obj.items[0] = 99;
    await flushEffects();
    assert(triggered === 1, 'Length unchanged, should NOT trigger');
    assert(obj.items[0] === 99, 'Value is changed');

    // But push changes length, so it triggers
    obj.items.push(4);
    await flushEffects();
    assert(triggered === 2, 'push() changes length, should trigger');
  });

  test('Reactive - sparse array with index assignment', async () => {
    const obj = reactive({ items: [] });
    let lengthTriggers = 0;
    let indexTriggers = 0;

    effect(() => {
      obj.items.length;
      lengthTriggers++;
    });

    effect(() => {
      obj.items[999];
      indexTriggers++;
    });

    await flushEffects();
    assert(lengthTriggers === 1);
    assert(indexTriggers === 1);

    // Direct index assignment far beyond current length
    obj.items[999] = 'value';
    await flushEffects();
    assert(indexTriggers === 2, 'Index 999 should trigger its effect');
    assert(lengthTriggers === 2, 'Length changed from 0 to 1000, should trigger');
    assert(obj.items[999] === 'value', 'Value is set');
    assert(obj.items.length === 1000, 'Array length updated');
  });

  test('Reactive - multiple indices tracked independently', async () => {
    const obj = reactive({ items: [1, 2, 3] });
    let trigger0 = 0;
    let trigger1 = 0;

    effect(() => {
      obj.items[0];
      trigger0++;
    });

    effect(() => {
      obj.items[1];
      trigger1++;
    });

    await flushEffects();
    assert(trigger0 === 1);
    assert(trigger1 === 1);

    // Change index 0
    obj.items[0] = 99;
    await flushEffects();
    assert(trigger0 === 2, 'Effect tracking index 0 should trigger');
    assert(trigger1 === 1, 'Effect tracking index 1 should NOT trigger');

    // Change index 1
    obj.items[1] = 88;
    await flushEffects();
    assert(trigger0 === 2, 'Effect tracking index 0 should NOT trigger');
    assert(trigger1 === 2, 'Effect tracking index 1 should trigger');
  });

  test('Reactive - array methods still work and trigger all effects', async () => {
    const obj = reactive({ items: [1, 2, 3] });
    let triggered = 0;

    effect(() => {
      obj.items[0];
      obj.items.length;
      triggered++;
    });

    await flushEffects();
    assert(triggered === 1);

    // Array methods trigger all tracked properties
    obj.items.push(4);
    await flushEffects();
    assert(triggered === 2, 'push() should trigger');
    assert(obj.items.length === 4);

    obj.items.splice(0, 1, 99);
    await flushEffects();
    assert(triggered === 3, 'splice() should trigger');
    assert(obj.items[0] === 99);
  });
};

