import { reactive } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';

export default ({ test, assert }) => {

  test('Infinite loop detection - many synchronous triggers', async () => {
    const state = reactive({ items: [] });

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
        // Just read the array, don't modify
        state.items.length;
      });

      await flushEffects();
      const initialRuns = effectRuns;

      // Now trigger 150 synchronous changes BEFORE any flush happens
      // Each change calls trigger(), which calls queueEffect()
      // queueEffect increments effectTriggerCount, and after 100 calls
      // it logs error and stops adding to queue
      for (let i = 0; i < 150; i++) {
        state.items = [...state.items, i]; // Each assignment triggers the effect
      }

      // Now flush - the effect will run once (it's in Set only once)
      await flushEffects();

      // Should have detected infinite loop and logged error
      assert.ok(errorLogged, 'Should have logged infinite loop error');
      assert.ok(errorMessage.includes('Infinite loop detected'), 'Error message should mention infinite loop');
      assert.ok(errorMessage.includes('100 times'), 'Error message should mention 100 times (MAX_TRIGGER_COUNT)');

      // Effect should have run initial + 1 time (it's in Set only once, but error was logged)
      assert.ok(effectRuns === initialRuns + 1, `Effect should run initial + 1 time, got ${effectRuns}`);

    } finally {
      console.error = originalError;
    }
  });

  test('Infinite loop detection - mechanism exists', async () => {
    // This test verifies normal usage doesn't trigger detection

    const state = reactive({ count: 0 });

    // Capture console.error to check it's NOT called
    let errorLogged = false;
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0] && args[0].includes && args[0].includes('Infinite loop')) {
        errorLogged = true;
      }
      originalError(...args); // Still log for visibility
    };

    try {
      // Normal effect should work fine
      let runs = 0;
      effect(() => {
        runs++;
        state.count;
      });

      await flushEffects();

      // Change state multiple times
      for (let i = 0; i < 10; i++) {
        state.count++;
        await flushEffects();
      }

      // Normal usage should not trigger error
      assert.ok(!errorLogged, 'Normal usage should not trigger infinite loop detection');
      assert.ok(runs > 0, 'Effect should have run');

    } finally {
      console.error = originalError;
    }
  });

  test('Effect trigger count resets after flush', async () => {
    const state = reactive({ count: 0 });
    let effectRuns = 0;

    effect(() => {
      effectRuns++;
      state.count;
    });

    await flushEffects();
    const runsAfterFirst = effectRuns;

    // Trigger many times in new cycle
    for (let i = 0; i < 50; i++) {
      state.count++;
    }
    await flushEffects();

    // Should have run again (counter resets)
    assert.ok(effectRuns > runsAfterFirst, 'Effect should run in new cycle');
  });

  test('Multiple effects work correctly', async () => {
    const state = reactive({ a: 0, b: 0 });
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

    // Both should run initially
    assert.equal(effect1Runs, 1, 'Effect 1 should run once initially');
    assert.equal(effect2Runs, 1, 'Effect 2 should run once initially');

    // Trigger first
    state.a++;
    await flushEffects();

    assert.equal(effect1Runs, 2, 'Effect 1 should run after state.a change');
    assert.equal(effect2Runs, 1, 'Effect 2 should not run');

    // Trigger second
    state.b++;
    await flushEffects();

    assert.equal(effect1Runs, 2, 'Effect 1 should not run');
    assert.equal(effect2Runs, 2, 'Effect 2 should run after state.b change');
  });

};


