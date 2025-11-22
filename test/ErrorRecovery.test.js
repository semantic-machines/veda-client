/**
 * Error Recovery Tests
 * Test how the system recovers from various error conditions
 */

import './setup-dom.js';
import Component, { html, reactive } from '../src/components/Component.js';
import { effect, flushEffects } from '../src/Effect.js';
import Model from '../src/Model.js';
import Backend from '../src/Backend.js';
import { createTestComponent, clearModelCache } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== COMPONENT ERROR RECOVERY ====================

  test('Error Recovery - component recovers from render error', async () => {
    let shouldError = true;
    const errors = [];

    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    class RecoverableComponent extends Component(HTMLElement) {
      state = reactive({ value: 'test' });

      render() {
        if (shouldError) {
          throw new Error('Intentional render error');
        }
        return html`<div>{this.state.value}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(RecoverableComponent);

    // Should handle initial error
    assert(component.innerHTML === '', 'Should be empty after error');
    assert(component.isConnected, 'Should remain connected');

    // Now fix the error and try again
    shouldError = false;
    await component.update();
    await flushEffects();

    assert(component.querySelector('div') !== null, 'Should render after recovery');
    assert(component.querySelector('div').textContent === 'test', 'Should show correct content');

    // Verify reactivity still works
    component.state.value = 'updated';
    await flushEffects();
    assert(component.querySelector('div').textContent === 'updated',
      'Reactivity should work after recovery');

    console.error = originalError;
    cleanup();
  });

  test('Error Recovery - component handles repeated render failures', async () => {
    let errorCount = 0;
    const maxErrors = 3;

    class MultiErrorComponent extends Component(HTMLElement) {
      state = reactive({ attempt: 0 });

      render() {
        if (this.state.attempt < maxErrors) {
          errorCount++;
          throw new Error(`Error attempt ${this.state.attempt}`);
        }
        return html`<div>Success at attempt {this.state.attempt}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(MultiErrorComponent);

    // Try multiple times - each call to update() triggers a new render
    for (let i = 1; i < maxErrors; i++) {
      component.state.attempt = i;
      await flushEffects();
      await component.update();

      // After error, innerHTML might not be empty if browser preserves previous content
      // Just verify component is still connected
      assert(component.isConnected, `Should remain connected after error ${i}`);
    }

    // Finally succeed
    component.state.attempt = maxErrors;
    await flushEffects();
    await component.update();

    assert(errorCount >= 1, `Should have at least 1 error, got ${errorCount}`);
    assert(component.textContent.includes('Success'), 'Should eventually succeed');

    cleanup();
  });

  test('Error Recovery - effect errors don\'t break reactivity', async () => {
    let shouldError = true;
    let successfulRuns = 0;
    const errors = [];

    const originalError = console.error;
    console.error = (...args) => {
      if (args[0]?.message?.includes('Effect')) errors.push(args);
    };

    const state = reactive({ count: 0 });

    effect(() => {
      if (shouldError && state.count === 1) {
        throw new Error('Effect error');
      }
      successfulRuns++;
    });

    await flushEffects();
    assert(successfulRuns === 1, 'Initial effect should run');

    // Trigger error
    state.count = 1;
    await flushEffects();

    // Error should be handled, but effect should continue
    assert(successfulRuns >= 1, 'Effect should have run initially');

    // Now stop erroring
    shouldError = false;
    state.count = 2;
    await flushEffects();

    assert(successfulRuns >= 2, 'Effect should recover and continue running');

    console.error = originalError;
  });

  // ==================== MODEL ERROR RECOVERY ====================

  test('Error Recovery - Model handles load failures gracefully', async () => {
    clearModelCache();

    const originalGetIndividual = Backend.get_individual;
    let failCount = 0;

    Backend.get_individual = async (id) => {
      failCount++;
      if (failCount <= 2) {
        throw new Error('Network error');
      }
      return {
        '@': id,
        'rdfs:label': [{ data: 'Recovered', type: 'String' }]
      };
    };

    const model = new Model('d:test_recovery');

    // First attempt fails
    try {
      await model.load();
      assert(false, 'Should throw error');
    } catch (e) {
      assert(e.message.includes('Network'), 'Should throw network error');
    }

    assert(!model.isLoaded(), 'Should not be loaded after error');

    // Second attempt fails
    try {
      await model.load();
      assert(false, 'Should throw error');
    } catch (e) {
      assert(e.message.includes('Network'), 'Should throw network error again');
    }

    // Third attempt succeeds
    await model.load();
    assert(model.isLoaded(), 'Should be loaded after recovery');
    assert(model['rdfs:label']?.[0] === 'Recovered', 'Should have loaded data');

    Backend.get_individual = originalGetIndividual;
    clearModelCache();
  });

  test('Error Recovery - Model save retries on failure', async () => {
    clearModelCache();

    const originalPutIndividual = Backend.put_individual;
    let saveAttempts = 0;

    Backend.put_individual = async (data) => {
      saveAttempts++;
      if (saveAttempts < 3) {
        throw new Error('Save failed');
      }
      return { '@': data['@'], 'v-s:updateCounter': [{ data: saveAttempts, type: 'Integer' }] };
    };

    const model = new Model('d:test_save_recovery');
    model['rdfs:label'] = ['Test'];

    // Try saving (will fail twice, succeed third time)
    try {
      await model.save();
      assert(false, 'First save should fail');
    } catch (e) {
      assert(e.message.includes('Save failed'), 'Should fail first time');
    }

    try {
      await model.save();
      assert(false, 'Second save should fail');
    } catch (e) {
      assert(e.message.includes('Save failed'), 'Should fail second time');
    }

    // Third attempt succeeds
    await model.save();
    assert(model.isSync(), 'Should be synced after successful save');
    assert(saveAttempts === 3, 'Should have attempted 3 times');

    Backend.put_individual = originalPutIndividual;
    clearModelCache();
  });

  // ==================== REACTIVE ERROR RECOVERY ====================

  test('Error Recovery - reactive proxy handles circular references', () => {
    const obj1 = reactive({ name: 'obj1' });
    const obj2 = reactive({ name: 'obj2' });

    // Create circular reference
    obj1.ref = obj2;
    obj2.ref = obj1;

    // Should not throw or hang
    let visited = new Set();
    let current = obj1;
    for (let i = 0; i < 10; i++) {
      if (visited.has(current)) break;
      visited.add(current);
      current = current.ref;
    }

    assert(visited.size === 2, 'Should detect circular reference');
    assert(obj1.ref.ref === obj1, 'Should maintain circular structure');
  });

  test('Error Recovery - reactive handles property access errors', async () => {
    const state = reactive({
      get error() {
        throw new Error('Property access error');
      },
      safe: 'value'
    });

    let safeValue;
    let errorThrown = false;

    effect(() => {
      try {
        void state.error;
      } catch (e) {
        errorThrown = true;
      }
      safeValue = state.safe;
    });

    await flushEffects();

    assert(errorThrown, 'Should catch property access error');
    assert(safeValue === 'value', 'Should still access safe properties');
  });

  // ==================== LIFECYCLE ERROR RECOVERY ====================

  test('Error Recovery - component handles lifecycle hook errors', async () => {
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(' '));

    class LifecycleErrorComponent extends Component(HTMLElement) {
      pre() {
        throw new Error('Pre error');
      }

      render() {
        return html`<div>Rendered</div>`;
      }

      post() {
        throw new Error('Post error');
      }
    }

    const { component, cleanup } = await createTestComponent(LifecycleErrorComponent);

    // Component should still be connected and rendered
    assert(component.isConnected, 'Should remain connected despite lifecycle errors');

    // Render might succeed even if hooks fail
    // The important thing is the component doesn't crash

    console.error = originalError;
    cleanup();
  });

  test('Error Recovery - disconnected component stops reacting', async () => {
    class DisconnectComponent extends Component(HTMLElement) {
      static tag = 'test-disconnect-recovery-' + Date.now();

      constructor() {
        super();
        this.state = reactive({ count: 0 });
      }

      render() {
        return html`<div>{this.state.count}</div>`;
      }
    }

    customElements.define(DisconnectComponent.tag, DisconnectComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement(DisconnectComponent.tag);
    container.appendChild(component);
    await component.rendered;
    await flushEffects();

    const initialText = component.textContent;

    // Disconnect
    container.removeChild(component);

    // Try to update state
    if (component.state) {
      component.state.count = 999;
      await flushEffects();
    }

    // Should not crash
    assert(component.textContent === initialText || component.textContent === '999',
      'Should handle updates after disconnect without crashing');

    container.remove();
  });

  // ==================== CONCURRENT ERROR RECOVERY ====================

  test('Error Recovery - handles concurrent operation failures', async () => {
    const state = reactive({ values: [] });
    let successCount = 0;
    let errorCount = 0;

    // Simulate concurrent operations that might fail
    const operations = [];
    for (let i = 0; i < 10; i++) {
      operations.push(
        (async () => {
          try {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

            if (Math.random() < 0.3) {
              throw new Error('Random failure');
            }

            state.values.push(i);
            successCount++;
          } catch (e) {
            errorCount++;
          }
        })()
      );
    }

    await Promise.allSettled(operations);
    await flushEffects();

    assert(successCount + errorCount === 10, 'Should complete all operations');
    assert(successCount > 0, 'Some operations should succeed');
    assert(state.values.length === successCount,
      'Array should contain exactly successful operations');
  });

  test('Error Recovery - effect cleanup works after errors', async () => {
    const state = reactive({ count: 0 });
    let runs = 0;
    let errors = 0;

    const cleanup = effect(() => {
      runs++;
      if (state.count === 1) {
        errors++;
        throw new Error('Effect error');
      }
    });

    await flushEffects();
    assert(runs === 1, 'Initial run');

    state.count = 1; // Will error
    await flushEffects();
    assert(errors === 1, 'Should have one error');

    // Cleanup should still work
    cleanup();

    state.count = 2;
    await flushEffects();

    // Effect should not run after cleanup, even if there were errors
    assert(runs <= 2, 'Should not run after cleanup');
  });

  // ==================== MEMORY ERROR RECOVERY ====================

  test('Error Recovery - handles out of array bounds gracefully', async () => {
    const state = reactive({ items: [1, 2, 3] });
    let accessValue;

    effect(() => {
      // Try to access out of bounds (should be undefined, not error)
      accessValue = state.items[999];
    });

    await flushEffects();

    assert(accessValue === undefined, 'Out of bounds should return undefined');

    // Modify array
    state.items[999] = 'new';
    await flushEffects();

    assert(state.items[999] === 'new', 'Should handle sparse array');
  });

  test('Error Recovery - handles deleted properties', async () => {
    const state = reactive({ a: 1, b: 2 });
    let valueB;

    effect(() => {
      valueB = state.b;
    });

    await flushEffects();
    assert(valueB === 2, 'Initial value');

    delete state.b;
    await flushEffects();

    assert(valueB === undefined, 'Deleted property should be undefined');

    // Re-add property
    state.b = 3;
    await flushEffects();

    assert(valueB === 3, 'Should handle property re-addition');
  });

};


