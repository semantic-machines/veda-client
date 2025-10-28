import {effect, flushEffects} from '../src/Effect.js';
import {reactive} from '../src/Reactive.js';

export default ({test, assert}) => {
  // ==================== BASIC EFFECT FUNCTIONALITY ====================

  test('Effect - basic reactivity', async () => {
    const state = reactive({count: 0});
    let effectValue = 0;

    effect(() => {
      effectValue = state.count;
    });

    await flushEffects();
    assert.equal(effectValue, 0, 'Initial effect should run');

    state.count = 5;
    await flushEffects();
    assert.equal(effectValue, 5, 'Effect should run when dependency changes');
  });

  test('Effect - cleanup function', async () => {
    const state = reactive({count: 0});
    let effectRuns = 0;

    const cleanup = effect(() => {
      effectRuns++;
      state.count;
    });

    await flushEffects();
    const runsBeforeCleanup = effectRuns;

    cleanup();

    state.count++;
    await flushEffects();

    assert.equal(effectRuns, runsBeforeCleanup, 'Effect should not run after cleanup');
  });

  test('Effect - multiple dependencies', async () => {
    const state = reactive({a: 1, b: 2});
    let sum = 0;

    effect(() => {
      sum = state.a + state.b;
    });

    await flushEffects();
    assert.equal(sum, 3);

    state.a = 10;
    await flushEffects();
    assert.equal(sum, 12, 'Effect should react to first dependency');

    state.b = 20;
    await flushEffects();
    assert.equal(sum, 30, 'Effect should react to second dependency');
  });

  test('Effect - batching multiple changes', async () => {
    const state = reactive({count: 0});
    let effectRuns = 0;

    effect(() => {
      effectRuns++;
      state.count;
    });

    await flushEffects();
    const initialRuns = effectRuns;

    // Multiple synchronous changes
    state.count = 1;
    state.count = 2;
    state.count = 3;

    await flushEffects();

    assert.equal(effectRuns, initialRuns + 1, 'Effect should batch multiple changes into one run');
    assert.equal(state.count, 3, 'Final value should be correct');
  });

  test('Effect - nested effects', async () => {
    const state = reactive({count: 0});
    let outerRuns = 0;
    let innerRuns = 0;

    effect(() => {
      outerRuns++;
      state.count;

      effect(() => {
        innerRuns++;
        state.count;
      });
    });

    await flushEffects();

    assert.ok(outerRuns > 0, 'Outer effect should run');
    assert.ok(innerRuns > 0, 'Inner effect should run');
  });

  // ==================== INFINITE LOOP DETECTION ====================

  test('Effect - infinite loop detection triggers on many synchronous changes', async () => {
    const state = reactive({items: []});

    let errorLogged = false;
    let errorMessage = '';
    const originalError = console.error;
    console.error = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('Infinite loop detected')) {
        errorLogged = true;
        errorMessage = msg;
      }
    };

    try {
      let effectRuns = 0;
      effect(() => {
        effectRuns++;
        state.items.length;
      });

      await flushEffects();
      const initialRuns = effectRuns;

      // Each change calls trigger() → queueEffect()
      // After 100 calls, it logs error and stops adding to queue
      for (let i = 0; i < 150; i++) {
        state.items = [...state.items, i];
      }

      await flushEffects();

      assert.ok(errorLogged, 'Should have logged infinite loop error');
      assert.ok(errorMessage.includes('Infinite loop detected'), 'Error message should mention infinite loop');
      assert.ok(errorMessage.includes('100 times'), 'Error message should mention MAX_TRIGGER_COUNT');
      assert.ok(effectRuns === initialRuns + 1, `Effect should run initial + 1 time, got ${effectRuns}`);

    } finally {
      console.error = originalError;
    }
  });

  test('Effect - normal usage does not trigger infinite loop detection', async () => {
    const state = reactive({count: 0});

    let errorLogged = false;
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0] && args[0].includes && args[0].includes('Infinite loop')) {
        errorLogged = true;
      }
      originalError(...args);
    };

    try {
      let runs = 0;
      effect(() => {
        runs++;
        state.count;
      });

      await flushEffects();

      // Change state multiple times with flushes
      for (let i = 0; i < 10; i++) {
        state.count++;
        await flushEffects();
      }

      assert.ok(!errorLogged, 'Normal usage should not trigger infinite loop detection');
      assert.ok(runs > 0, 'Effect should have run');

    } finally {
      console.error = originalError;
    }
  });

  test('Effect - trigger count resets after flush', async () => {
    const state = reactive({count: 0});
    let effectRuns = 0;

    effect(() => {
      effectRuns++;
      state.count;
    });

    await flushEffects();
    const runsAfterFirst = effectRuns;

    for (let i = 0; i < 50; i++) {
      state.count++;
    }
    await flushEffects();

    assert.ok(effectRuns > runsAfterFirst, 'Effect should run in new cycle after counter reset');
  });

  // ==================== MULTIPLE EFFECTS ====================

  test('Effect - multiple independent effects', async () => {
    const state = reactive({a: 0, b: 0});
    let effect1Runs = 0;
    let effect2Runs = 0;

    effect(() => {
      effect1Runs++;
      state.a;
    });

    effect(() => {
      effect2Runs++;
      state.b;
    });

    await flushEffects();

    assert.equal(effect1Runs, 1, 'Effect 1 should run once initially');
    assert.equal(effect2Runs, 1, 'Effect 2 should run once initially');

    state.a++;
    await flushEffects();

    assert.equal(effect1Runs, 2, 'Effect 1 should run after state.a change');
    assert.equal(effect2Runs, 1, 'Effect 2 should not run');

    state.b++;
    await flushEffects();

    assert.equal(effect1Runs, 2, 'Effect 1 should not run');
    assert.equal(effect2Runs, 2, 'Effect 2 should run after state.b change');
  });

  test('Effect - multiple effects on same state', async () => {
    const state = reactive({count: 0});
    let effect1Value = 0;
    let effect2Value = 0;

    effect(() => {
      effect1Value = state.count * 2;
    });

    effect(() => {
      effect2Value = state.count + 10;
    });

    await flushEffects();
    assert.equal(effect1Value, 0);
    assert.equal(effect2Value, 10);

    state.count = 5;
    await flushEffects();

    assert.equal(effect1Value, 10, 'Both effects should react to same state');
    assert.equal(effect2Value, 15, 'Both effects should react to same state');
  });

  // ==================== EDGE CASES ====================

  test('Effect - no dependencies', async () => {
    let runs = 0;

    effect(() => {
      runs++;
      // No reactive dependencies
    });

    await flushEffects();

    assert.equal(runs, 1, 'Effect with no dependencies should run once');
  });

  test('Effect - conditional dependencies', async () => {
    const state = reactive({useA: true, a: 1, b: 2});
    let result = 0;

    effect(() => {
      result = state.useA ? state.a : state.b;
    });

    await flushEffects();
    assert.equal(result, 1);

    state.a = 10;
    await flushEffects();
    assert.equal(result, 10, 'Should react to active branch');

    state.useA = false;
    await flushEffects();
    assert.equal(result, 2, 'Should switch to other branch');
  });
};

