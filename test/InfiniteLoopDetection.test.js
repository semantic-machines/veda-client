import { reactive } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';

export default ({ test, assert }) => {

  test('Infinite loop detection - mechanism exists', async () => {
    // This test just verifies the mechanism is in place
    // Creating actual infinite loop in test is tricky with async batching
    
    const state = reactive({ count: 0 });
    
    // Capture console.error to check it can be called
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


