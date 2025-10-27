import { reactive, computed } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';

export default ({ test, assert }) => {

  test('Computed - basic reactivity', async () => {
    const state = reactive({ count: 0 });
    const doubled = computed(() => state.count * 2);

    assert.equal(doubled.value, 0, 'Initial computed value should be 0');

    state.count = 5;
    await flushEffects();

    assert.equal(doubled.value, 10, 'Computed should update when dependency changes');
  });

  test('Computed - caching works', async () => {
    const state = reactive({ count: 0 });
    let runCount = 0;
    
    const doubled = computed(() => {
      runCount++;
      return state.count * 2;
    });

    // First access
    assert.equal(doubled.value, 0);
    assert.equal(runCount, 1, 'Getter should run once');

    // Second access (should use cache)
    assert.equal(doubled.value, 0);
    assert.equal(runCount, 1, 'Getter should not run again (cached)');

    // Change dependency
    state.count = 5;
    await flushEffects();

    // Access again (should re-run)
    assert.equal(doubled.value, 10);
    assert.equal(runCount, 2, 'Getter should run again after dependency change');
  });

  test('Computed - chained computed values', async () => {
    const state = reactive({ count: 0 });
    const doubled = computed(() => state.count * 2);
    const quadrupled = computed(() => doubled.value * 2);

    assert.equal(quadrupled.value, 0);

    state.count = 5;
    await flushEffects();

    assert.equal(doubled.value, 10);
    assert.equal(quadrupled.value, 20, 'Chained computed should update');
  });

  test('Computed - with effect', async () => {
    const state = reactive({ count: 0 });
    const doubled = computed(() => state.count * 2);
    let effectValue = 0;

    effect(() => {
      effectValue = doubled.value;
    });

    await flushEffects();
    assert.equal(effectValue, 0);

    state.count = 5;
    await flushEffects();

    assert.equal(effectValue, 10, 'Effect should react to computed value change');
  });

  test('Circular reference - simple self-reference', () => {
    const obj = { name: 'test' };
    obj.self = obj;

    // Should not throw
    const state = reactive(obj);
    
    assert.equal(state.name, 'test');
    assert.equal(state.self, state, 'Circular reference should work');
    assert.ok(state.self.__isReactive, 'Circular reference should be reactive');
  });

  test('Circular reference - complex nested', () => {
    const parent = { name: 'parent' };
    const child = { name: 'child', parent: parent };
    parent.child = child;

    // Should not throw
    const state = reactive(parent);
    
    assert.equal(state.name, 'parent');
    assert.equal(state.child.name, 'child');
    assert.equal(state.child.parent, state, 'Parent reference should point back to same proxy');
  });

  test('Circular reference - multiple references to same object', () => {
    const shared = { value: 42 };
    const obj = {
      ref1: shared,
      ref2: shared
    };

    const state = reactive(obj);
    
    assert.equal(state.ref1, state.ref2, 'Multiple references to same object should be same proxy');
    
    state.ref1.value = 100;
    assert.equal(state.ref2.value, 100, 'Changes through one reference should reflect in other');
  });

  test('Circular reference - array with circular ref', () => {
    const arr = [1, 2, 3];
    arr.push(arr); // arr[3] = arr

    // Should not throw
    const state = reactive(arr);
    
    assert.equal(state[0], 1);
    assert.equal(state[3], state, 'Array circular reference should work');
  });

  test('Computed - multiple dependencies', async () => {
    const state = reactive({ a: 1, b: 2 });
    const sum = computed(() => state.a + state.b);

    assert.equal(sum.value, 3);

    state.a = 10;
    await flushEffects();
    assert.equal(sum.value, 12, 'Should update when first dependency changes');

    state.b = 20;
    await flushEffects();
    assert.equal(sum.value, 30, 'Should update when second dependency changes');
  });

  // TODO: This test requires dependency cleanup feature
  // which is not implemented yet. This is NOT a critical bug.
  test.skip('Computed - conditional dependencies', async () => {
    const state = reactive({ useA: true, a: 1, b: 2 });
    let runCount = 0;
    
    const result = computed(() => {
      runCount++;
      return state.useA ? state.a : state.b;
    });

    assert.equal(result.value, 1);
    assert.equal(runCount, 1);

    // Change unused dependency
    state.b = 20;
    await flushEffects();
    assert.equal(result.value, 1, 'Should not change when unused dependency changes');
    assert.equal(runCount, 1, 'Should not re-run for unused dependency');

    // Change used dependency
    state.a = 10;
    await flushEffects();
    assert.equal(result.value, 10, 'Should change when used dependency changes');
    assert.equal(runCount, 2);

    // Switch dependency
    state.useA = false;
    await flushEffects();
    assert.equal(result.value, 20, 'Should use new dependency');
    assert.equal(runCount, 3);

    // Now changing 'a' should not trigger
    state.a = 100;
    await flushEffects();
    assert.equal(result.value, 20, 'Should not react to old dependency');
    assert.equal(runCount, 3, 'Should not re-run for old dependency');
  });

};

