import {reactive} from '../src/Reactive.js';
import {effect, flushEffects} from '../src/Effect.js';

/**
 * Tests for documented limitation: Array index assignment is NOT reactive
 * See LIMITATIONS.md for details
 */
export default ({test, assert}) => {
  test('Reactive - array index assignment is NOT reactive (documented limitation)', async () => {
    const obj = reactive({ items: [1, 2, 3] });
    let triggered = 0;

    effect(() => {
      obj.items.length; // Track array
      triggered++;
    });

    await flushEffects();
    assert(triggered === 1, 'Initial effect run');

    // ❌ This is documented as NOT reactive
    obj.items[0] = 99;
    await flushEffects();
    assert(triggered === 1, 'Index assignment should NOT trigger effect');
    assert(obj.items[0] === 99, 'Value is changed, but no reactivity');

    // ✅ This IS reactive - mutation methods
    obj.items.splice(0, 1, 100);
    await flushEffects();
    assert(triggered === 2, 'splice() should trigger effect');

    // ✅ Reassignment IS reactive
    obj.items = [...obj.items];
    obj.items[0] = 200;
    obj.items = obj.items.slice();
    await flushEffects();
    assert(triggered === 3, 'Array reassignment should trigger effect');
  });

  test('Reactive - sparse array with index assignment (edge case)', async () => {
    const obj = reactive({ items: [] });
    let triggered = 0;

    effect(() => {
      obj.items.length; // Track length
      triggered++;
    });

    await flushEffects();
    assert(triggered === 1);

    // Direct index assignment far beyond current length
    obj.items[999] = 'value';
    await flushEffects();
    assert(triggered === 1, 'Sparse array index assignment should NOT trigger');
    assert(obj.items[999] === 'value', 'Value is set');
    assert(obj.items.length === 1000, 'Array length updated');

    // But length change via push WILL trigger
    obj.items.push('another');
    await flushEffects();
    assert(triggered === 2, 'push() should trigger');
  });

  test('Reactive - workaround 1: use splice for index assignment', async () => {
    const obj = reactive({ items: [1, 2, 3] });
    let triggered = 0;

    effect(() => {
      obj.items.length; // Track array
      triggered++;
    });

    await flushEffects();
    assert(triggered === 1);

    // ✅ splice works
    obj.items.splice(1, 1, 99); // Replace index 1
    await flushEffects();
    assert(triggered === 2, 'splice should trigger');
    assert(obj.items[1] === 99, 'Value updated');
  });

  test('Reactive - workaround 2: reassign array after modification', async () => {
    const obj = reactive({ items: [1, 2, 3] });
    let triggered = 0;

    effect(() => {
      obj.items.length; // Track array
      triggered++;
    });

    await flushEffects();
    assert(triggered === 1);

    // ✅ Reassign after modification
    obj.items[0] = 99;
    obj.items = obj.items.slice(); // Force new reference
    await flushEffects();
    assert(triggered === 2, 'Reassignment should trigger');
    assert(obj.items[0] === 99, 'Value updated');
  });
};

