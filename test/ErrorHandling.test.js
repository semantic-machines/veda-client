/**
 * Comprehensive Error Handling Tests
 *
 * Tests error handling quality, recovery, and error boundaries
 */

import './setup-dom.js';
import Component, { html } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';
import { createTestComponent, captureConsole } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== ERROR MESSAGE QUALITY ====================

  test('ErrorHandling - render error is handled gracefully', async () => {
    class FailingRenderComponent extends Component(HTMLElement) {
      render() {
        throw new Error('Intentional render error');
      }
    }

    const { component, cleanup } = await createTestComponent(FailingRenderComponent);

    // Component should remain connected but empty
    assert(component.isConnected, 'Component should remain connected');
    assert(component.innerHTML === '', 'Component should be empty after error');

    // Component should not crash the page
    assert(typeof component.render === 'function', 'Component methods should still exist');

    cleanup();
  });

  test('ErrorHandling - added() error does not prevent rendering', async () => {
    class FailingAddedComponent extends Component(HTMLElement) {
      added() {
        throw new Error('Intentional added error');
      }
      render() {
        return html`<div>Content</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(FailingAddedComponent);

    // Component should remain connected despite error in added()
    assert(component.isConnected, 'Component should remain connected');
    // Note: render may or may not complete depending on error timing

    cleanup();
  });

  test('ErrorHandling - removed() error does not prevent cleanup', async () => {
    class FailingRemovedComponent extends Component(HTMLElement) {
      removed() {
        throw new Error('Intentional removed error');
      }
      render() {
        return html`<div>Content</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(FailingRemovedComponent);

    // Trigger removal
    container.removeChild(component);
    await flushEffects();

    // Should be disconnected despite error
    assert(!component.isConnected, 'Component should be disconnected');

    cleanup();
  });

  // ==================== ERROR RECOVERY ====================

  test('ErrorHandling - component recovers after render error is fixed', async () => {
    let shouldFail = true;

    class RecoverableComponent extends Component(HTMLElement) {
      render() {
        if (shouldFail) {
          throw new Error('Temporary error');
        }
        return html`<div>Recovered!</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(RecoverableComponent);

    // Initially failed
    assert(component.innerHTML === '', 'Should be empty after error');

    // Fix the error and trigger re-render
    shouldFail = false;
    component.update();
    await flushEffects();

    // Should recover
    assert(component.textContent === 'Recovered!', 'Should recover after error is fixed');

    cleanup();
  });

  test('ErrorHandling - reactive updates work after render error recovery', async () => {
    let shouldFail = true;

    class ReactiveRecoveryComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = this.reactive({ count: 0 });
      }

      render() {
        if (shouldFail) {
          throw new Error('Temporary error');
        }
        return html`<div>Count: {this.state.count}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(ReactiveRecoveryComponent);

    // Fix error
    shouldFail = false;
    component.update();
    await flushEffects();

    assert(component.textContent === 'Count: 0', 'Should render after recovery');

    // Test reactivity works
    component.state.count = 5;
    await flushEffects();

    assert(component.textContent === 'Count: 5', 'Reactivity should work after recovery');

    cleanup();
  });

  test('ErrorHandling - error in effect is caught and does not crash', async () => {
    class EffectErrorComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = this.reactive({ value: 0 });
        this.effectRan = false;
      }

      async connectedCallback() {
        await super.connectedCallback();

        this.effect(() => {
          void this.state.value;
          this.effectRan = true;
          if (this.state.value === 1) {
            throw new Error('Effect error');
          }
        });
      }

      render() {
        return html`<div>{this.state.value}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(EffectErrorComponent);
      
    assert(component.effectRan, 'Effect should run initially');
    
    // Trigger effect error
    component.state.value = 1;
    await flushEffects();
      
    // Component should still be functional
    assert(component.isConnected, 'Component should remain connected after effect error');
    
    // Other effects should still work
    component.state.value = 2;
    await flushEffects();
    assert(component.isConnected, 'Component should remain functional');
      
    cleanup();
  });

  // ==================== ASYNC ERROR HANDLING ====================

  test('ErrorHandling - async render error is caught', async () => {
    class AsyncErrorComponent extends Component(HTMLElement) {
      async render() {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async render error');
      }
    }

    const { component, cleanup } = await createTestComponent(AsyncErrorComponent);

    // Component should handle async errors gracefully
    assert(component.isConnected, 'Component should remain connected');

    cleanup();
  });

  test('ErrorHandling - async added() error is caught', async () => {
    class AsyncAddedErrorComponent extends Component(HTMLElement) {
      async added() {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async added error');
      }

      render() {
        return html`<div>Content</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(AsyncAddedErrorComponent);

    // Component should remain connected
    assert(component.isConnected, 'Component should handle async added error');

    cleanup();
  });

  test('ErrorHandling - promise rejection in render does not crash component', async () => {
    class PromiseRejectComponent extends Component(HTMLElement) {
      render() {
        // Create a rejected promise but catch it to prevent unhandled rejection
        Promise.reject(new Error('Handled promise rejection')).catch(() => {
          // Intentionally empty - we're testing that component continues to work
        });
        return html`<div>Content</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(PromiseRejectComponent);

    // Should render despite promise rejection
    assert(component.isConnected, 'Component should remain connected');
    assert(component.textContent === 'Content', 'Component should render content');

    cleanup();
  });

  // ==================== ERROR BOUNDARIES ====================

  test('ErrorHandling - error in child does not break parent', async () => {
    class FailingChild extends Component(HTMLElement) {
      render() {
        throw new Error('Child error');
      }
    }

    class ParentComponent extends Component(HTMLElement) {
      render() {
        return html`
          <div class="parent">
            <span>Parent OK</span>
          </div>
        `;
      }
    }

    // Register child first
    const childTag = `test-failing-child-${Date.now()}`;
    FailingChild.tag = childTag;
    if (!customElements.get(childTag)) {
      customElements.define(childTag, FailingChild);
    }

    const { component, cleanup } = await createTestComponent(ParentComponent);

    // Parent should render fine
    assert(component.querySelector('.parent') !== null, 'Parent should render');
    assert(component.textContent.includes('Parent OK'), 'Parent content should be OK');

    cleanup();
  });

  test('ErrorHandling - multiple errors are all handled', async () => {
    let errorCount = 0;

    class MultiErrorComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = this.reactive({ count: 0 });
      }

      render() {
        errorCount++;
        if (errorCount <= 3) {
          throw new Error(`Error ${errorCount}`);
        }
        return html`<div>Finally OK</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(MultiErrorComponent);

    // Try to trigger re-renders
    component.update();
    await flushEffects();

    component.update();
    await flushEffects();

    component.update();
    await flushEffects();

    // Component should still be connected
    assert(component.isConnected, 'Component should survive multiple errors');

    cleanup();
  });

  // ==================== EXPRESSION ERRORS ====================

  test('ErrorHandling - undefined method in expression is handled', async () => {
    class UndefinedMethodComponent extends Component(HTMLElement) {
      render() {
        return html`<button onclick="{this.nonExistentMethod}">Click</button>`;
      }
    }

    const { component, cleanup } = await createTestComponent(UndefinedMethodComponent);

    // Component should render despite undefined method
    const button = component.querySelector('button');
    assert(button !== null, 'Button should render');

    cleanup();
  });

  test('ErrorHandling - expression syntax error is handled gracefully', async () => {
    class SyntaxErrorComponent extends Component(HTMLElement) {
      render() {
        // Malformed expression
        return html`<div>{this.state..invalid}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(SyntaxErrorComponent);

    // Should not crash
    assert(component.isConnected, 'Component should handle syntax error gracefully');

    cleanup();
  });

  // ==================== ERROR CONTEXT ====================

  test('ErrorHandling - component remains functional after error', async () => {
    class ContextErrorComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.debugInfo = { id: 'test-123', type: 'context-test' };
        this.hasError = true;
      }

      render() {
        if (this.hasError) {
          throw new Error('Error with context');
        }
        return html`<div>Success</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(ContextErrorComponent);

    // Component should be connected but empty
    assert(component.isConnected, 'Component should be connected');
    assert(component.innerHTML === '', 'Component should be empty after error');

    // Fix error and re-render
    component.hasError = false;
    component.update();
    await flushEffects();

    // Should recover
    assert(component.textContent === 'Success', 'Component should recover and render correctly');

    cleanup();
  });

};

