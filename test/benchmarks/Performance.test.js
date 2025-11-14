/**
 * Performance Benchmarks
 *
 * These tests measure performance of critical operations
 * to detect performance regressions early.
 *
 * Run with: pnpm test:benchmark
 * Results are logged but don't fail the test suite.
 */

import {reactive} from '../../src/Reactive.js';
import {effect, flushEffects} from '../../src/Effect.js';
import Model from '../../src/Model.js';
import Component, {html} from '../../src/components/Component.js';
import {timeout} from '../../src/Util.js';

const ITERATIONS = 1000;
const LARGE_ARRAY_SIZE = 1000;

export default ({test, assert}) => {

  // ==================== REACTIVE SYSTEM BENCHMARKS ====================

  test('Benchmark - reactive object creation', () => {
    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      reactive({
        count: i,
        name: `Item ${i}`,
        nested: { value: i * 2 }
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = Math.round((ITERATIONS / elapsed) * 1000);

    console.log(`\n📊 Reactive object creation: ${elapsed.toFixed(2)}ms for ${ITERATIONS} objects`);
    console.log(`   → ${opsPerSec.toLocaleString()} ops/sec`);
    console.log(`   → ${(elapsed / ITERATIONS).toFixed(3)}ms per object`);

    assert(elapsed < 1000, `Should create ${ITERATIONS} reactive objects in < 1s (${elapsed}ms)`);
  });

  test('Benchmark - effect execution', async () => {
    const state = reactive({ count: 0 });
    let effectRuns = 0;

    effect(() => {
      state.count;
      effectRuns++;
    });

    const start = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
      state.count = i;
    }

    await flushEffects();
    const elapsed = performance.now() - start;
    const updatesPerSec = Math.round((ITERATIONS / elapsed) * 1000);

    console.log(`\n📊 Effect execution: ${elapsed.toFixed(2)}ms for ${ITERATIONS} updates`);
    console.log(`   → ${updatesPerSec.toLocaleString()} updates/sec`);
    console.log(`   → Effect ran ${effectRuns} times`);

    assert(elapsed < 2000, `Should execute ${ITERATIONS} updates in < 2s (${elapsed}ms)`);
  });

  test('Benchmark - nested reactive objects', () => {
    const start = performance.now();

    const state = reactive({
      level1: {
        level2: {
          level3: {
            level4: {
              value: 0
            }
          }
        }
      }
    });

    for (let i = 0; i < ITERATIONS; i++) {
      state.level1.level2.level3.level4.value = i;
    }

    const elapsed = performance.now() - start;

    console.log(`\n📊 Nested reactive updates: ${elapsed.toFixed(2)}ms for ${ITERATIONS} deep updates`);
    console.log(`   → ${Math.round((ITERATIONS / elapsed) * 1000).toLocaleString()} updates/sec`);

    assert(elapsed < 1000, `Should handle ${ITERATIONS} nested updates in < 1s (${elapsed}ms)`);
  });

  // ==================== ARRAY OPERATIONS BENCHMARKS ====================

  test('Benchmark - reactive array operations', async () => {
    const state = reactive({ items: [] });
    let effectRuns = 0;

    effect(() => {
      state.items.length;
      effectRuns++;
    });

    const start = performance.now();

    // Push operations
    for (let i = 0; i < 100; i++) {
      state.items.push({ id: i, value: `Item ${i}` });
    }

    await flushEffects();

    // Filter operations
    state.items = state.items.filter(item => item.id % 2 === 0);
    await flushEffects();

    // Map operations
    state.items = state.items.map(item => ({ ...item, doubled: item.id * 2 }));
    await flushEffects();

    const elapsed = performance.now() - start;

    console.log(`\n📊 Reactive array operations: ${elapsed.toFixed(2)}ms`);
    console.log(`   → 100 pushes + filter + map`);
    console.log(`   → Effect ran ${effectRuns} times`);

    assert(elapsed < 500, `Array operations should complete in < 500ms (${elapsed}ms)`);
  });

  test('Benchmark - large array creation', () => {
    const start = performance.now();

    const state = reactive({
      items: Array.from({ length: LARGE_ARRAY_SIZE }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random()
      }))
    });

    const elapsed = performance.now() - start;

    console.log(`\n📊 Large array creation: ${elapsed.toFixed(2)}ms for ${LARGE_ARRAY_SIZE} items`);
    console.log(`   → ${(elapsed / LARGE_ARRAY_SIZE).toFixed(3)}ms per item`);

    assert(state.items.length === LARGE_ARRAY_SIZE, 'Should create all items');
    assert(elapsed < 200, `Should create ${LARGE_ARRAY_SIZE} items in < 200ms (${elapsed}ms)`);
  });

  // ==================== MODEL BENCHMARKS ====================

  test('Benchmark - Model creation', () => {
    const start = performance.now();

    const models = [];
    for (let i = 0; i < ITERATIONS; i++) {
      models.push(new Model(`test:model-${i}`));
    }

    const elapsed = performance.now() - start;
    const modelsPerSec = Math.round((ITERATIONS / elapsed) * 1000);

    console.log(`\n📊 Model creation: ${elapsed.toFixed(2)}ms for ${ITERATIONS} models`);
    console.log(`   → ${modelsPerSec.toLocaleString()} models/sec`);

    assert(elapsed < 500, `Should create ${ITERATIONS} models in < 500ms (${elapsed}ms)`);
  });

  test('Benchmark - Model property access', () => {
    const model = new Model('test:benchmark');
    model['rdfs:label'] = ['Test Label'];
    model['v-s:author'] = [new Model('v-s:Person')];
    model['v-s:created'] = [new Date()];

    const start = performance.now();

    for (let i = 0; i < ITERATIONS * 10; i++) {
      const label = model['rdfs:label'];
      const author = model['v-s:author'];
      const created = model['v-s:created'];
    }

    const elapsed = performance.now() - start;
    const accessesPerSec = Math.round(((ITERATIONS * 10 * 3) / elapsed) * 1000);

    console.log(`\n📊 Model property access: ${elapsed.toFixed(2)}ms for ${ITERATIONS * 10 * 3} accesses`);
    console.log(`   → ${accessesPerSec.toLocaleString()} accesses/sec`);

    assert(elapsed < 100, `Should access properties in < 100ms (${elapsed}ms)`);
  });

  // ==================== COMPONENT BENCHMARKS ====================

  test('Benchmark - Component creation', async () => {
    class BenchComponent extends Component(HTMLElement) {
      static tag = 'bench-component';

      constructor() {
        super();
        this.state = this.reactive({ value: 0 });
      }

      render() {
        return html`<div>{this.state.value}</div>`;
      }
    }

    if (!customElements.get('bench-component')) {
      customElements.define('bench-component', BenchComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const start = performance.now();

    const components = [];
    for (let i = 0; i < 100; i++) {
      const comp = document.createElement('bench-component');
      container.appendChild(comp);
      components.push(comp);
    }

    // Wait for all to render
    await Promise.all(components.map(c => c.rendered));
    await flushEffects();

    const elapsed = performance.now() - start;

    console.log(`\n📊 Component creation: ${elapsed.toFixed(2)}ms for 100 components`);
    console.log(`   → ${(elapsed / 100).toFixed(2)}ms per component`);

    container.remove();

    assert(elapsed < 2000, `Should create 100 components in < 2s (${elapsed}ms)`);
  });

  test('Benchmark - Component updates', async () => {
    class UpdateBenchComponent extends Component(HTMLElement) {
      static tag = 'update-bench-component';

      constructor() {
        super();
        this.state = this.reactive({ count: 0 });
      }

      render() {
        return html`<div>{this.state.count}</div>`;
      }
    }

    if (!customElements.get('update-bench-component')) {
      customElements.define('update-bench-component', UpdateBenchComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('update-bench-component');
    container.appendChild(component);
    await component.rendered;

    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      component.state.count = i;
    }

    await flushEffects();
    const elapsed = performance.now() - start;

    console.log(`\n📊 Component updates: ${elapsed.toFixed(2)}ms for 100 updates`);
    console.log(`   → ${Math.round((100 / elapsed) * 1000)} updates/sec`);

    container.remove();

    assert(elapsed < 1000, `Should update 100 times in < 1s (${elapsed}ms)`);
  });

  // ==================== MEMORY BENCHMARKS ====================

  test('Benchmark - Memory usage (reactive objects)', () => {
    if (typeof globalThis.gc !== 'function') {
      console.log('\n⚠️  Memory benchmarks require --expose-gc flag');
      return;
    }

    globalThis.gc();
    const memBefore = process.memoryUsage().heapUsed;

    const objects = [];
    for (let i = 0; i < 1000; i++) {
      objects.push(reactive({
        id: i,
        name: `Item ${i}`,
        data: Array.from({ length: 10 }, (_, j) => j)
      }));
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memDiff = memAfter - memBefore;
    const memPerObject = memDiff / 1000;

    console.log(`\n📊 Memory usage (1000 reactive objects):`);
    console.log(`   → Total: ${(memDiff / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   → Per object: ${(memPerObject / 1024).toFixed(2)} KB`);

    // Cleanup
    objects.length = 0;
    globalThis.gc();

    assert(memPerObject < 10000, `Memory per object should be < 10KB (${(memPerObject / 1024).toFixed(2)}KB)`);
  });

  test('Benchmark - Memory usage (components)', async () => {
    if (typeof globalThis.gc !== 'function') {
      console.log('\n⚠️  Memory benchmarks require --expose-gc flag');
      return;
    }

    class MemBenchComponent extends Component(HTMLElement) {
      static tag = 'mem-bench-component';

      constructor() {
        super();
        this.state = this.reactive({ items: Array.from({ length: 10 }, (_, i) => i) });
      }

      render() {
        return html`<div>{this.state.items.join(',')}</div>`;
      }
    }

    if (!customElements.get('mem-bench-component')) {
      customElements.define('mem-bench-component', MemBenchComponent);
    }

    globalThis.gc();
    await timeout(100);
    const memBefore = process.memoryUsage().heapUsed;

    const container = document.createElement('div');
    document.body.appendChild(container);

    const components = [];
    for (let i = 0; i < 100; i++) {
      const comp = document.createElement('mem-bench-component');
      container.appendChild(comp);
      components.push(comp);
    }

    await Promise.all(components.map(c => c.rendered));
    await flushEffects();

    const memAfter = process.memoryUsage().heapUsed;
    const memDiff = memAfter - memBefore;
    const memPerComponent = memDiff / 100;

    console.log(`\n📊 Memory usage (100 components):`);
    console.log(`   → Total: ${(memDiff / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   → Per component: ${(memPerComponent / 1024).toFixed(2)} KB`);

    container.remove();
    globalThis.gc();

    assert(memPerComponent < 100000, `Memory per component should be < 100KB (${(memPerComponent / 1024).toFixed(2)}KB)`);
  });

  // ==================== SUMMARY ====================

  test('Benchmark - Summary', () => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    console.log('All benchmarks completed successfully!');
    console.log('Run with --expose-gc flag for memory benchmarks.');
    console.log('='.repeat(60) + '\n');

    assert(true, 'All benchmarks completed');
  });
};

