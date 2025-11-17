/**
 * Long-Running Integration Tests
 * Test system behavior over extended periods and with sustained load
 */

import './setup-dom.js';
import { reactive } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';
import Component, { html } from '../src/components/Component.js';
import Model from '../src/Model.js';
import Subscription from '../src/Subscription.js';
import { createTestComponent, clearModelCache } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== SUSTAINED LOAD TESTS ====================

  test('Long-running - sustained reactive updates for 1000 iterations', async () => {
    const state = reactive({ counter: 0, accumulated: 0 });
    let effectRuns = 0;

    effect(() => {
      effectRuns++;
      state.accumulated = state.counter;
    });

    await flushEffects();
    const start = performance.now();

    // Run 1000 updates
    for (let i = 0; i < 1000; i++) {
      state.counter = i;
      if (i % 100 === 0) {
        await flushEffects();
      }
    }

    await flushEffects();
    const duration = performance.now() - start;

    assert(state.counter === 999, 'Should reach final count');
    assert(state.accumulated === 999, 'Should accumulate final value');
    assert(duration < 5000, `1000 iterations took ${duration.toFixed(2)}ms, should be under 5s`);
    assert(effectRuns > 1, 'Effect should run multiple times');
  });

  test('Long-running - component lifecycle over many updates', async () => {
    class LongRunningComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ value: 0, history: [] });
      }

      render() {
        return html`<div>Value: {this.state.value}, Updates: {this.state.history.length}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(LongRunningComponent);
    const start = performance.now();

    // Perform 500 updates
    for (let i = 0; i < 500; i++) {
      component.state.value = i;
      component.state.history.push(i);

      if (i % 50 === 0) {
        await flushEffects();
      }
    }

    await flushEffects();
    const duration = performance.now() - start;

    assert(component.state.value === 499, 'Should have final value');
    assert(component.state.history.length === 500, 'Should have full history');
    assert(component.isConnected, 'Should remain connected');
    assert(duration < 3000, `500 component updates took ${duration.toFixed(2)}ms, should be under 3s`);

    cleanup();
  });

  // ==================== MEMORY PROFILING TESTS ====================

  test('Memory - effect cleanup releases references', async () => {
    const state = reactive({ value: 0 });
    const cleanups = [];
    const initialMemory = global.gc ? process.memoryUsage().heapUsed : 0;

    // Create 1000 effects
    for (let i = 0; i < 1000; i++) {
      const cleanup = effect(() => {
        void state.value;
      });
      cleanups.push(cleanup);
    }

    await flushEffects();

    const withEffectsMemory = global.gc ? process.memoryUsage().heapUsed : 0;

    // Cleanup all effects
    cleanups.forEach(c => c());

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await flushEffects();

    const afterCleanupMemory = global.gc ? process.memoryUsage().heapUsed : 0;

    // Memory should not grow indefinitely
    if (global.gc) {
      const memoryGrowth = afterCleanupMemory - initialMemory;
      const maxAcceptableGrowth = 10 * 1024 * 1024; // 10MB

      assert(memoryGrowth < maxAcceptableGrowth,
        `Memory grew by ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, should be under 10MB`);
    }

    // Verify effects don't run
    state.value = 999;
    await flushEffects();
    // No assertion needed - just verify no crash
  });

  test('Memory - component cleanup releases all references', async () => {
    const components = [];
    const initialMemory = global.gc ? process.memoryUsage().heapUsed : 0;

    // Create 50 components using createTestComponent which handles unique tags
    for (let i = 0; i < 50; i++) {
      class MemoryTestComponent extends Component(HTMLElement) {
        constructor() {
          super();
          this.state = reactive({ data: new Array(1000).fill(0) });
        }
        render() {
          return html`<div>{this.state.data.length}</div>`;
        }
      }

      const { component, cleanup } = await createTestComponent(MemoryTestComponent);
      components.push({ component, cleanup });
    }

    const withComponentsMemory = global.gc ? process.memoryUsage().heapUsed : 0;

    // Cleanup all components
    components.forEach(({ cleanup }) => cleanup());
    components.length = 0;

    // Force garbage collection
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const afterCleanupMemory = global.gc ? process.memoryUsage().heapUsed : 0;

    if (global.gc) {
      const memoryGrowth = afterCleanupMemory - initialMemory;
      const maxAcceptableGrowth = 20 * 1024 * 1024; // 20MB

      assert(memoryGrowth < maxAcceptableGrowth,
        `Memory grew by ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, should be under 20MB`);
    }
  });

  test('Memory - Model cache doesn\'t grow unbounded', () => {
    clearModelCache();

    // Create many models
    for (let i = 0; i < 1000; i++) {
      const model = new Model(`d:mem_test_${i}`);
      model['rdfs:label'] = [`Label ${i}`];
    }

    const cacheSize = Model.cache._getSize();
    assert(cacheSize >= 1000, `Should cache models, got ${cacheSize}`);

    // Clear and verify
    clearModelCache();
    assert(Model.cache._getSize() === 0, 'Cache should be clearable');
  });

  // ==================== SUBSCRIPTION LONGEVITY TESTS ====================

  test('Long-running - subscription handles multiple updates', async () => {
    const testId = 'd:long_running_sub_' + Date.now();
    const model = new Model(testId);

    model['rdfs:label'] = ['Initial'];
    let updateCount = 0;

    model.on('modified', () => {
      updateCount++;
    });

    const start = performance.now();

    // Simulate 100 updates
    for (let i = 0; i < 100; i++) {
      model['rdfs:label'] = [`Update ${i}`];
    }

    const duration = performance.now() - start;

    assert(updateCount === 100, 'Should receive all updates');
    assert(duration < 500, `100 model updates took ${duration.toFixed(2)}ms, should be under 500ms`);

    clearModelCache();
  });

  // ==================== STRESS OVER TIME TESTS ====================

  test('Long-running - reactive state with growing data structure', async () => {
    const state = reactive({ items: [], metadata: {} });
    let sumValue = 0;

    effect(() => {
      sumValue = state.items.reduce((acc, val) => acc + val, 0);
    });

    await flushEffects();
    const start = performance.now();

    // Gradually grow data structure
    for (let i = 0; i < 100; i++) {
      state.items.push(i);
      state.metadata[`key_${i}`] = i * 2;

      if (i % 20 === 0) {
        await flushEffects();
      }
    }

    await flushEffects();
    const duration = performance.now() - start;

    assert(state.items.length === 100, 'Should have 100 items');
    assert(Object.keys(state.metadata).length === 100, 'Should have 100 metadata keys');
    assert(sumValue === 4950, 'Sum should be correct'); // sum(0..99)
    assert(duration < 1000, `Growing data structure took ${duration.toFixed(2)}ms, should be under 1s`);
  });

  test('Long-running - nested effects over many iterations', async () => {
    const state = reactive({ outer: 0, inner: 0 });
    let outerRuns = 0;
    let innerRuns = 0;

    effect(() => {
      outerRuns++;
      void state.outer;

      effect(() => {
        innerRuns++;
        void state.inner;
      });
    });

    await flushEffects();
    const start = performance.now();

    // Update both values multiple times
    for (let i = 0; i < 50; i++) {
      state.outer = i;
      state.inner = i;

      if (i % 10 === 0) {
        await flushEffects();
      }
    }

    await flushEffects();
    const duration = performance.now() - start;

    assert(outerRuns > 1, 'Outer effect should run multiple times');
    assert(innerRuns > 1, 'Inner effect should run multiple times');
    assert(duration < 2000, `Nested effects took ${duration.toFixed(2)}ms, should be under 2s`);
  });

  // ==================== STABILITY TESTS ====================

  test('Long-running - no memory leaks with repeated create/destroy cycles', async () => {
    const initialMemory = global.gc ? process.memoryUsage().heapUsed : 0;

    // 10 cycles of create/destroy
    for (let cycle = 0; cycle < 10; cycle++) {
      const components = [];

      // Create 20 components
      for (let i = 0; i < 20; i++) {
        class CycleComponent extends Component(HTMLElement) {
          state = reactive({ value: 0 });
          render() {
            return html`<span>{this.state.value}</span>`;
          }
        }

        const { component, cleanup } = await createTestComponent(CycleComponent);
        component.state.value = i;
        components.push({ component, cleanup });
      }

      await flushEffects();

      // Destroy all
      components.forEach(({ cleanup }) => cleanup());

      if (global.gc && cycle % 3 === 0) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const finalMemory = global.gc ? process.memoryUsage().heapUsed : 0;

    if (global.gc) {
      const memoryGrowth = finalMemory - initialMemory;
      const maxAcceptableGrowth = 30 * 1024 * 1024; // 30MB

      assert(memoryGrowth < maxAcceptableGrowth,
        `Memory grew by ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB after 10 cycles, should be under 30MB`);
    }
  });

  test('Long-running - reactive array operations over extended period', async () => {
    const state = reactive({ items: [] });
    let operationCount = 0;

    effect(() => {
      operationCount = state.items.length;
    });

    await flushEffects();
    const start = performance.now();

    // Mix of operations
    for (let i = 0; i < 200; i++) {
      const op = i % 4;

      if (op === 0) {
        state.items.push(i);
      } else if (op === 1 && state.items.length > 0) {
        state.items.pop();
      } else if (op === 2 && state.items.length > 1) {
        state.items.splice(Math.floor(Math.random() * state.items.length), 1);
      } else {
        state.items.unshift(i);
      }

      if (i % 25 === 0) {
        await flushEffects();
      }
    }

    await flushEffects();
    const duration = performance.now() - start;

    assert(Array.isArray(state.items), 'Should maintain array type');
    assert(typeof operationCount === 'number', 'Should track operations');
    assert(duration < 2000, `200 array operations took ${duration.toFixed(2)}ms, should be under 2s`);
  });

  // ==================== CONCURRENT LONG-RUNNING TESTS ====================

  test('Long-running - concurrent state updates over time', async () => {
    const state = reactive({
      counters: { a: 0, b: 0, c: 0 },
      sum: 0
    });

    effect(() => {
      state.sum = state.counters.a + state.counters.b + state.counters.c;
    });

    await flushEffects();
    const start = performance.now();

    // Simulate concurrent updates
    const updates = [];
    for (let i = 0; i < 30; i++) {
      updates.push((async () => {
        for (let j = 0; j < 10; j++) {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
          const key = ['a', 'b', 'c'][i % 3];
          state.counters[key]++;
        }
      })());
    }

    await Promise.all(updates);
    await flushEffects();
    const duration = performance.now() - start;

    const expectedSum = state.counters.a + state.counters.b + state.counters.c;
    assert(state.sum === expectedSum, `Sum should be ${expectedSum}, got ${state.sum}`);
    assert(duration < 5000, `Concurrent updates took ${duration.toFixed(2)}ms, should be under 5s`);
  });

};


