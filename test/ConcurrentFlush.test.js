/**
 * Concurrent Flush Tests
 * Tests for Effect.js:44 - race condition guard: if (isFlushing)
 */

import { reactive } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';

export default ({ test, assert }) => {

  test('ConcurrentFlush - multiple simultaneous flushEffects calls', async () => {
    const state = reactive({ count: 0 });
    let effectRuns = 0;

    effect(() => {
      effectRuns += state.count;
    });

    await flushEffects();
    assert(effectRuns === 0, 'Initial run');
    effectRuns = 0;

    // Trigger change and call flush multiple times concurrently
    state.count = 5;
    
    // These should be handled gracefully - second call hits the guard
    const results = await Promise.all([
      flushEffects(),
      flushEffects(),  // This should hit: if (isFlushing) return Promise.resolve()
      flushEffects()
    ]);

    // All promises should resolve
    assert(results.length === 3, 'All flush promises resolved');
    assert(effectRuns === 5, 'Effect ran once despite multiple flush calls');
  });

  test('ConcurrentFlush - nested flush during effect', async () => {
    const state1 = reactive({ value: 0 });
    const state2 = reactive({ value: 0 });
    let effectExecutions = 0;

    effect(() => {
      effectExecutions++;
      void state1.value;
      
      // Try to trigger flush during effect execution
      if (state1.value === 1) {
        state2.value = 100;
        // This flush might hit the guard if we're still flushing
        flushEffects();
      }
    });

    effect(() => {
      void state2.value;
    });

    await flushEffects();
    const initialRuns = effectExecutions;

    state1.value = 1;
    await flushEffects();

    // Should handle nested flush gracefully
    assert(effectExecutions > initialRuns, 'Effects executed');
    assert(state2.value === 100, 'Nested state change applied');
  });

  test('ConcurrentFlush - rapid sequential changes', async () => {
    const state = reactive({ counter: 0 });
    let snapshots = [];

    effect(() => {
      snapshots.push(state.counter);
    });

    await flushEffects();
    snapshots = [];

    // Rapid changes
    for (let i = 1; i <= 10; i++) {
      state.counter = i;
    }

    // Multiple flushes - some should hit the guard
    await Promise.all([
      flushEffects(),
      flushEffects(),
      flushEffects()
    ]);

    // Should batch into single run
    assert(snapshots.length === 1, 'Changes batched into single effect run');
    assert(snapshots[0] === 10, 'Final value captured');
  });
};

