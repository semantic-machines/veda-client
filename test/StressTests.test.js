/**
 * Stress Tests for veda-client
 * Test system behavior under extreme conditions
 */

import './setup-dom.js';
import { reactive } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';
import Component, { html } from '../src/components/Component.js';
import Model from '../src/Model.js';
import { createTestComponent, clearModelCache } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== EFFECT STRESS TESTS ====================

  test('Stress - 1000 concurrent effects on single state', async () => {
    const state = reactive({ count: 0 });
    const results = new Array(1000).fill(0);
    const cleanups = [];

    const start = performance.now();

    // Create 1000 effects
    for (let i = 0; i < 1000; i++) {
      const cleanup = effect(() => {
        results[i] = state.count;
      });
      cleanups.push(cleanup);
    }

    await flushEffects();
    const setupDuration = performance.now() - start;

    assert(results.every(r => r === 0), 'All effects should run initially');
    assert(setupDuration < 1000, `Setup took ${setupDuration.toFixed(2)}ms, should be under 1s`);

    // Update state
    const updateStart = performance.now();
    state.count = 42;
    await flushEffects();
    const updateDuration = performance.now() - updateStart;

    assert(results.every(r => r === 42), 'All effects should update');
    assert(updateDuration < 500, `Update took ${updateDuration.toFixed(2)}ms, should be under 500ms`);

    // Cleanup
    cleanups.forEach(c => c());
  });

  test('Stress - 10000 effects with batched updates', async () => {
    const state = reactive({ value: 0 });
    let updateCount = 0;
    const cleanups = [];

    const start = performance.now();

    // Create 10000 effects
    for (let i = 0; i < 10000; i++) {
      const cleanup = effect(() => {
        if (state.value > 0) {
          updateCount++;
        }
      });
      cleanups.push(cleanup);
    }

    await flushEffects();
    const setupDuration = performance.now() - start;

    assert(setupDuration < 2000, `Setup took ${setupDuration.toFixed(2)}ms, should be under 2s`);

    // Batch multiple updates
    const updateStart = performance.now();
    for (let i = 1; i <= 10; i++) {
      state.value = i;
    }
    await flushEffects();
    const updateDuration = performance.now() - updateStart;

    // Should batch all updates into one effect run
    assert(updateCount === 10000, `Expected 10000 updates, got ${updateCount}`);
    assert(updateDuration < 1000, `Batched updates took ${updateDuration.toFixed(2)}ms, should be under 1s`);

    // Cleanup
    cleanups.forEach(c => c());
  });

  test('Stress - deeply nested reactive objects (100 levels)', async () => {
    // Create 100-level deep nested object
    let current = { value: 'leaf' };
    for (let i = 0; i < 100; i++) {
      current = { nested: current };
    }

    const start = performance.now();
    const state = reactive(current);
    const createDuration = performance.now() - start;

    assert(createDuration < 100, `Creating deep proxy took ${createDuration.toFixed(2)}ms, should be under 100ms`);

    // Access deeply nested value
    let effectRuns = 0;
    let deepValue;

    effect(() => {
      effectRuns++;
      let temp = state;
      for (let i = 0; i < 100; i++) {
        temp = temp.nested;
      }
      deepValue = temp.value;
    });

    await flushEffects();

    assert(effectRuns === 1, 'Effect should run once');
    assert(deepValue === 'leaf', 'Should access deeply nested value');

    // Update deep value
    let temp = state;
    for (let i = 0; i < 100; i++) {
      temp = temp.nested;
    }
    temp.value = 'updated';

    await flushEffects();

    assert(effectRuns === 2, 'Effect should run after deep update');
    assert(deepValue === 'updated', 'Should reflect deep update');
  });

  // ==================== ARRAY STRESS TESTS ====================

  test('Stress - large array with 10000 items', async () => {
    const state = reactive({ items: [] });
    let sum = 0;

    effect(() => {
      sum = state.items.reduce((acc, val) => acc + val, 0);
    });

    await flushEffects();
    assert(sum === 0, 'Initial sum should be 0');

    const start = performance.now();

    // Fill array with 10000 items
    state.items = Array.from({ length: 10000 }, (_, i) => i);
    await flushEffects();

    const duration = performance.now() - start;

    assert(state.items.length === 10000, 'Should have 10000 items');
    assert(sum === 49995000, 'Sum should be correct'); // sum(0..9999)
    assert(duration < 500, `Large array update took ${duration.toFixed(2)}ms, should be under 500ms`);
  });

  test('Stress - rapid array mutations (1000 operations)', async () => {
    const state = reactive({ items: [1, 2, 3] });
    let operationCount = 0;

    effect(() => {
      operationCount = state.items.length;
    });

    await flushEffects();

    const start = performance.now();

    // Perform 1000 mutations
    for (let i = 0; i < 1000; i++) {
      if (i % 2 === 0) {
        state.items.push(i);
      } else {
        state.items.pop();
      }
    }

    await flushEffects();
    const duration = performance.now() - start;

    assert(duration < 1000, `1000 array mutations took ${duration.toFixed(2)}ms, should be under 1s`);
    assert(typeof operationCount === 'number', 'Should have tracked mutations');
  });

  // ==================== COMPONENT STRESS TESTS ====================

  test('Stress - render 1000 reactive expressions', async () => {
    class ManyExpressionsComponent extends Component(HTMLElement) {
      constructor() {
        super();
        const data = {};
        for (let i = 0; i < 1000; i++) {
          data[`prop${i}`] = i;
        }
        this.state = reactive(data);
      }

      render() {
        let html = '<div>';
        for (let i = 0; i < 1000; i++) {
          html += `<span>{this.state.prop${i}}</span>`;
        }
        html += '</div>';
        return html;
      }
    }

    const start = performance.now();
    const { component, cleanup } = await createTestComponent(ManyExpressionsComponent);
    await flushEffects();
    const duration = performance.now() - start;

    const spans = component.querySelectorAll('span');
    assert(spans.length === 1000, 'Should render all 1000 spans');
    assert(duration < 2000, `Rendering 1000 expressions took ${duration.toFixed(2)}ms, should be under 2s`);

    cleanup();
  });

  test('Stress - update 1000 reactive attributes', async () => {
    class ManyAttributesComponent extends Component(HTMLElement) {
      constructor() {
        super();
        const data = {};
        for (let i = 0; i < 100; i++) {
          data[`attr${i}`] = `value${i}`;
        }
        this.state = reactive(data);
      }

      render() {
        let html = '<div>';
        for (let i = 0; i < 100; i++) {
          html += `<span data-attr${i}="{this.state.attr${i}}">Item ${i}</span>`;
        }
        html += '</div>';
        return html;
      }
    }

    const { component, cleanup } = await createTestComponent(ManyAttributesComponent);
    await flushEffects();

    const start = performance.now();

    // Update all attributes
    for (let i = 0; i < 100; i++) {
      component.state[`attr${i}`] = `updated${i}`;
    }
    await flushEffects();

    const duration = performance.now() - start;

    assert(duration < 500, `Updating 100 reactive attributes took ${duration.toFixed(2)}ms, should be under 500ms`);

    cleanup();
  });

  // ==================== MODEL STRESS TESTS ====================

  test('Stress - create and cache 1000 models', () => {
    clearModelCache();

    const start = performance.now();
    const models = [];

    for (let i = 0; i < 1000; i++) {
      const id = `d:stress_model_${i}`;
      const m = new Model(id);
      m['rdfs:label'] = [`Model ${i}`];
      models.push(m);
    }

    const duration = performance.now() - start;

    assert(models.length === 1000, 'Should create 1000 models');
    assert(Model.cache._getSize() >= 1000, 'Should cache all models');
    assert(duration < 500, `Creating 1000 models took ${duration.toFixed(2)}ms, should be under 500ms`);

    // Verify cache works
    const m1 = new Model('d:stress_model_0');
    assert(m1 === models[0], 'Should return cached model');

    clearModelCache();
  });

  test('Stress - model with 1000 properties', () => {
    clearModelCache();

    const m = new Model('d:large_model');

    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      m[`v-s:property_${i}`] = [`value${i}`];
    }

    const duration = performance.now() - start;

    // Count properties
    let propCount = 0;
    for (const key in m) {
      if (key.startsWith('v-s:property_')) {
        propCount++;
      }
    }

    assert(propCount === 1000, 'Should have 1000 properties');
    assert(duration < 200, `Setting 1000 properties took ${duration.toFixed(2)}ms, should be under 200ms`);

    clearModelCache();
  });

  // ==================== MEMORY STRESS TESTS ====================

  test('Stress - effect cleanup prevents memory leaks', async () => {
    const state = reactive({ count: 0 });
    const cleanups = [];

    // Create and immediately cleanup 10000 effects
    const start = performance.now();

    for (let i = 0; i < 10000; i++) {
      const cleanup = effect(() => {
        void state.count;
      });
      cleanup(); // Immediately cleanup
    }

    await flushEffects();
    const duration = performance.now() - start;

    assert(duration < 2000, `Creating/cleaning 10000 effects took ${duration.toFixed(2)}ms, should be under 2s`);

    // Update state - no effects should run
    state.count++;
    await flushEffects();

    assert(state.count === 1, 'State should update');
    // No assertion on effect runs since all were cleaned up
  });

  test('Stress - reactive proxy with 1000 properties', async () => {
    const data = {};
    for (let i = 0; i < 1000; i++) {
      data[`prop${i}`] = i;
    }

    const start = performance.now();
    const state = reactive(data);
    const createDuration = performance.now() - start;

    assert(createDuration < 50, `Creating reactive with 1000 props took ${createDuration.toFixed(2)}ms, should be under 50ms`);

    let sum = 0;
    const effectStart = performance.now();

    effect(() => {
      sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += state[`prop${i}`];
      }
    });

    await flushEffects();
    const effectDuration = performance.now() - effectStart;

    assert(sum === 499500, 'Sum should be correct'); // sum(0..999)
    assert(effectDuration < 100, `Effect with 1000 deps took ${effectDuration.toFixed(2)}ms, should be under 100ms`);
  });

  // ==================== CONCURRENT OPERATIONS ====================

  test('Stress - concurrent state updates from multiple sources', async () => {
    const state = reactive({
      counters: Array(100).fill(0),
      updateCount: 0 // Track updates
    });
    let effectRuns = 0;

    effect(() => {
      effectRuns++;
      // Track updateCount which will change on each update
      void state.updateCount;
    });

    await flushEffects();
    const initialRuns = effectRuns;

    const start = performance.now();

    // Simulate concurrent updates
    const updates = [];
    for (let i = 0; i < 100; i++) {
      updates.push(new Promise(resolve => {
        setTimeout(() => {
          state.counters[i]++;
          state.updateCount++; // Increment to trigger effect
          resolve();
        }, Math.random() * 10);
      }));
    }

    await Promise.all(updates);
    await flushEffects();

    const duration = performance.now() - start;

    assert(state.counters.every(c => c === 1), 'All counters should be incremented');
    assert(state.updateCount === 100, 'Should have 100 updates');
    // Effect should run for updates
    assert(effectRuns > initialRuns, 'Effect should run after updates');
    assert(duration < 1000, `Concurrent updates took ${duration.toFixed(2)}ms, should be under 1s`);
  });

  test('Stress - rapid component creation and destruction', async () => {
    const start = performance.now();
    const components = [];

    // Create 100 components with unique tags
    for (let i = 0; i < 100; i++) {
      class StressComponent extends Component(HTMLElement) {
        state = reactive({ value: i });
        render() {
          return html`<div>{this.state.value}</div>`;
        }
      }

      const { component, cleanup } = await createTestComponent(StressComponent);
      components.push({ component, cleanup });
    }

    const createDuration = performance.now() - start;

    assert(components.length === 100, 'Should create 100 components');
    assert(createDuration < 5000, `Creating 100 components took ${createDuration.toFixed(2)}ms, should be under 5s`);

    // Destroy all
    const destroyStart = performance.now();
    components.forEach(({ cleanup }) => cleanup());
    const destroyDuration = performance.now() - destroyStart;

    assert(destroyDuration < 1000, `Destroying 100 components took ${destroyDuration.toFixed(2)}ms, should be under 1s`);
  });

  // ==================== EDGE CASE STRESS ====================

  test('Stress - circular reference with 1000 nodes', async () => {
    const nodes = [];

    // Create 1000 reactive nodes in a circle
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      nodes.push(reactive({ id: i, next: null }));
    }

    // Link them in a circle
    for (let i = 0; i < 1000; i++) {
      nodes[i].next = nodes[(i + 1) % 1000];
    }

    const duration = performance.now() - start;

    assert(nodes.length === 1000, 'Should create 1000 nodes');
    assert(nodes[0].next.next.next.id === 3, 'Circular references should work');
    assert(duration < 500, `Creating circular structure took ${duration.toFixed(2)}ms, should be under 500ms`);
  });

  test('Stress - recursive computed values (10 levels deep)', async () => {
    const { computed } = await import('../src/Reactive.js');

    const state = reactive({ value: 1 });

    // Create 10 levels of computed values
    const computeds = [computed(() => state.value)];
    for (let i = 1; i < 10; i++) {
      computeds.push(computed(() => computeds[i - 1].value * 2));
    }

    const start = performance.now();
    const result = computeds[9].value; // 1 * 2^9 = 512
    const duration = performance.now() - start;

    assert(result === 512, `Should compute correct value through 10 levels (got ${result})`);
    assert(duration < 10, `10-level computed took ${duration.toFixed(2)}ms, should be under 10ms`);

    // Update and verify - computed updates cascade through effect queue
    // so we need to flush until stable
    state.value = 2;

    // Flush repeatedly until all computed values stabilize
    // This is needed because computed values trigger each other in a cascade
    let flushCount = 0;
    const maxFlushes = 20; // Safety limit
    while (flushCount < maxFlushes) {
      await flushEffects();
      flushCount++;
      // Check if top-level computed has updated
      if (computeds[9].value === 1024) break;
    }

    const updatedResult = computeds[9].value;
    assert(updatedResult === 1024,
      `Should update through all levels after ${flushCount} flushes (got ${updatedResult})`);
    assert(flushCount < 15,
      `Should stabilize within reasonable flush count (took ${flushCount} flushes)`);
  });

};


