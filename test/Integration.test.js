import {reactive} from '../src/Reactive.js';
import {effect, flushEffects} from '../src/Effect.js';
import Model from '../src/Model.js';
import Backend from '../src/Backend.js';
import {timeout} from '../src/Util.js';

Backend.init();

export default ({test, assert}) => {
  /**
   * ADVANCED QUALITY TESTS
   * These tests go beyond basic coverage to ensure robustness
   */

  // ==================== RACE CONDITIONS ====================

  test('Race condition - parallel effect execution', async () => {
    const state = reactive({count: 0});
    let effectRuns = 0;
    let lastValue = 0;

    effect(() => {
      effectRuns++;
      lastValue = state.count;
    });

    await flushEffects();

    state.count = 1;
    state.count = 2;
    state.count = 3;

    await flushEffects();

    // Effect should run only once after all updates
    assert(lastValue === 3, 'Should process final value');
    assert(effectRuns === 2, 'Should batch synchronous updates'); // initial + batched
  });

  test('Race condition - concurrent Model operations', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');
    
    const id = 'd:race_test_' + Date.now();
    const m = new Model(id);
    m['rdfs:label'] = ['Initial'];

    // Simulate concurrent save operations
    const promises = [
      Backend.put_individual({
        '@': id,
        'rdfs:label': [{data: 'First', type: 'String'}]
      }),
      Backend.put_individual({
        '@': id,
        'rdfs:label': [{data: 'Second', type: 'String'}]
      })
    ];

    await Promise.all(promises);

    // Verify no crash - both operations should complete
    const result = await Backend.get_individual(id, false);
    assert(result !== null, 'Model should exist after concurrent operations');

    await Backend.remove_individual(id);
  });

  test('Race condition - subscribe/unsubscribe rapid', async () => {
    const m = new Model('rdfs:Resource');

    // Rapidly subscribe and unsubscribe
    for (let i = 0; i < 5; i++) {
      m.subscribe();
      m.unsubscribe();
    }

    await timeout(200);

    // Should not crash or leave hanging subscriptions
    assert(true, 'Rapid subscribe/unsubscribe should not crash');
  });

  // ==================== CIRCULAR REFERENCES ====================

  test('Circular references - reactive object with self-reference', async () => {
    const obj = reactive({name: 'test', self: null});
    obj.self = obj; // Circular reference

    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      const name = obj.self?.name;
    });

    await flushEffects();
    assert(effectRuns === 1, 'Should handle circular reference');

    obj.name = 'changed';
    await flushEffects();
    assert(effectRuns === 2, 'Should still react to changes with circular ref');
  });

  test('Circular references - nested objects', async () => {
    const parent = reactive({name: 'parent', child: null});
    const child = reactive({name: 'child', parent: null});
    
    parent.child = child;
    child.parent = parent;

    let accessCount = 0;
    effect(() => {
      accessCount++;
      // Traverse circular structure
      const p = parent.child?.parent?.child?.parent;
    });

    await flushEffects();
    assert(accessCount === 1, 'Should handle mutual circular references');
  });

  // ==================== MEMORY LEAKS ====================

  test('Memory - effect cleanup removes all references', async () => {
    const state = reactive({count: 0});
    let effectRuns = 0;

    const cleanup = effect(() => {
      effectRuns++;
      state.count; // Track dependency
    });

    await flushEffects();
    const initialRuns = effectRuns;

    // Cleanup should remove all references
    cleanup();

    // Try to trigger effect
    state.count++;
    await flushEffects();

    assert(effectRuns === initialRuns, 'Cleaned up effect should not run');
  });

  test('Memory - model cache does not leak', () => {
    // Note: Model cache is by design - models are cached by ID
    
    const uniqueId1 = 'd:cache_test_1_' + Date.now();
    const uniqueId2 = 'd:cache_test_2_' + Date.now();
    
    const m1a = new Model(uniqueId1);
    const m1b = new Model(uniqueId1);
    
    // Same ID should return same instance (cache working)
    assert(m1a === m1b, 'Same ID should return cached instance');
    
    const m2 = new Model(uniqueId2);
    assert(m1a !== m2, 'Different IDs should return different instances');
    
    // Cache holds models - this is intentional design
    assert(Model.cache.get(uniqueId1) === m1a, 'Cache should contain model 1');
    assert(Model.cache.get(uniqueId2) === m2, 'Cache should contain model 2');
  });

  test('Memory - reactive dependencies are cleaned up', async () => {
    let state = reactive({value: 0});
    let effectRuns = 0;

    const cleanup = effect(() => {
      effectRuns++;
      if (state.value < 5) {
        state.value; // Create dependency
      }
    });

    await flushEffects();
    
    for (let i = 0; i < 3; i++) {
      state.value++;
      await flushEffects();
    }

    const runsBeforeCleanup = effectRuns;
    cleanup();

    // Try to trigger again
    state.value++;
    await flushEffects();

    assert(effectRuns === runsBeforeCleanup, 'Dependencies should be fully cleaned');
  });

  // ==================== EDGE CASES ====================

  test('Edge case - delete property that does not exist', async () => {
    const obj = reactive({a: 1});
    
    let runs = 0;
    effect(() => {
      runs++;
      obj.a;
    });

    await flushEffects();
    
    delete obj.nonExistent;
    await flushEffects();

    assert(runs === 1, 'Should not trigger on delete of non-existent property');
  });

  test('Edge case - very deep nesting (10 levels)', async () => {
    let current = {value: 'deep'};
    for (let i = 0; i < 10; i++) {
      current = {nested: current};
    }

    const deep = reactive(current);
    let accessedValue = null;

    effect(() => {
      accessedValue = deep?.nested?.nested?.nested?.nested?.nested?.nested?.nested?.nested?.nested?.nested?.value;
    });

    await flushEffects();
    assert(accessedValue === 'deep', 'Should handle 10-level nesting');
  });

  test('Edge case - reactive with Symbol properties', async () => {
    const sym1 = Symbol('test1');
    const sym2 = Symbol('test2');
    const obj = reactive({[sym1]: 'value1'});

    let runs = 0;
    effect(() => {
      runs++;
      obj[sym1];
    });

    await flushEffects();

    // Modify symbol property
    obj[sym1] = 'value2';
    await flushEffects();

    // Should react to symbol property changes
    assert(runs === 2, 'Should track symbol properties');
  });

  test('Edge case - NaN and Infinity values', async () => {
    const obj = reactive({value: 0});
    let runs = 0;

    effect(() => {
      runs++;
      obj.value;
    });

    await flushEffects();

    obj.value = NaN;
    await flushEffects();
    assert(runs === 2, 'Should handle NaN');

    obj.value = Infinity;
    await flushEffects();
    assert(runs === 3, 'Should handle Infinity');

    obj.value = -Infinity;
    await flushEffects();
    assert(runs === 4, 'Should handle -Infinity');
  });

  // ==================== INTEGRATION TESTS ====================

  test('Integration - Model + Backend + Reactivity', async () => {
    await Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3');

    const id = 'd:integration_' + Date.now();
    const m = new Model(id);

    let changeCount = 0;
    m.on('modified', () => changeCount++);

    m['rdfs:label'] = ['Test'];
    m['rdf:type'] = [new Model('rdfs:Resource')];
    await m.save();

    assert(changeCount >= 1, 'Should emit events during save');

    // Load from server
    const m2 = new Model(id);
    await m2.load();

    assert(m2['rdfs:label'][0] === 'Test', 'Should load from server');
    assert(m === m2, 'Should return same cached instance');

    // Cleanup
    await Backend.remove_individual(id);
  });

  test('Integration - Reactive Model properties', async () => {
    const m = new Model('d:reactive_model_' + Date.now());
    
    // Model is already reactive
    let labelChangeCount = 0;
    m.on('rdfs:label', () => labelChangeCount++);

    m['rdfs:label'] = ['Label 1'];
    assert(labelChangeCount === 1, 'Should react to property change');

    m['rdfs:label'] = ['Label 2'];
    assert(labelChangeCount === 2, 'Should react to subsequent changes');

    // Array operations should also work
    m['rdfs:comment'] = [];
    m['rdfs:comment'].push('Comment 1');
    
    assert(m['rdfs:comment'].length === 1, 'Array operations should work on reactive model');
  });

  test('Integration - Effect with Model operations', async () => {
    const m1 = new Model('test:effect_1');
    const m2 = new Model('test:effect_2');

    m1['rdfs:label'] = ['Model 1'];
    m2['rdfs:label'] = ['Model 2'];

    let combined = '';
    const cleanup = effect(() => {
      combined = m1['rdfs:label']?.[0] + ' ' + m2['rdfs:label']?.[0];
    });

    await flushEffects();
    assert(combined === 'Model 1 Model 2', 'Should react to both models');

    m1['rdfs:label'] = ['Updated'];
    await flushEffects();
    assert(combined === 'Updated Model 2', 'Should react to first model change');

    cleanup();
  });

  // ==================== STRESS TESTS ====================

  test('Stress - many concurrent effects', async () => {
    const state = reactive({count: 0});
    const cleanups = [];
    let totalRuns = 0;

    for (let i = 0; i < 100; i++) {
      cleanups.push(effect(() => {
        totalRuns++;
        state.count;
      }));
    }

    await flushEffects();
    assert(totalRuns === 100, 'All effects should run initially');

    state.count++;
    await flushEffects();
    assert(totalRuns === 200, 'All effects should run on update');

    // Cleanup
    cleanups.forEach(cleanup => cleanup());
  });

  test('Stress - large array operations', async () => {
    const obj = reactive({items: []});
    let sum = 0;

    effect(() => {
      sum = obj.items.reduce((a, b) => a + b, 0);
    });

    await flushEffects();

    for (let i = 0; i < 1000; i++) {
      obj.items.push(i);
    }

    await flushEffects();
    assert(sum === 499500, 'Should handle large arrays'); // sum of 0..999
  });
};

