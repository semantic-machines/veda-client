/**
 * Behavioral tests for Component
 * These tests replace line-specific tests with behavior-focused scenarios
 * Focus: What the component SHOULD DO, not how it's implemented
 */

import './setup-dom.js';
import Component, { html, reactive } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';
import { createTestComponent } from './helpers.js';
import { performanceTest, adaptiveThreshold } from './performance-helpers.js';

export default ({ test, assert }) => {

  // ==================== REACTIVE STATE AUTO-DETECTION ====================

  test('Component - auto-detects reactive state from populate phase', async () => {
    const { reactive: makeReactive } = await import('../src/Reactive.js');

    class AutoReactiveComponent extends Component(HTMLElement) {
      async populate() {
        await super.populate();
        // Assign reactive state AFTER populate
        this.state = makeReactive({ value: 'auto-detected' });
      }

      render() {
        if (!this.state) return html`<div>No state</div>`;
        return html`<div>{this.state.value}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(AutoReactiveComponent);
    await flushEffects();

    assert(component.querySelector('div').textContent === 'auto-detected',
      'Should auto-detect reactive state created in populate');

    component.state.value = 'updated';
    await flushEffects();

    assert(component.querySelector('div').textContent === 'updated',
      'Should maintain reactivity after auto-detection');

    cleanup();
  });

  test('Component - auto-detects reactive state from _process phase', async () => {
    const { reactive: makeReactive } = await import('../src/Reactive.js');

    class ProcessReactiveComponent extends Component(HTMLElement) {
      constructor() {
        super();
        // Create reactive state before populate
        this.state = makeReactive({ value: 'process-reactive' });
      }

      render() {
        return html`<span>{this.state.value}</span>`;
      }
    }

    const { component, cleanup } = await createTestComponent(ProcessReactiveComponent);
    await flushEffects();

    const span = component.querySelector('span');
    assert(span.textContent === 'process-reactive',
      'Should render with detected reactive state');

    cleanup();
  });

  // ==================== FRAMEWORK COMPONENT TEMPLATE HANDLING ====================

  test('Component - handles framework components', async () => {
    class ComponentWithFramework extends Component(HTMLElement) {
      render() {
        return html`
          <div>
            <p>Before</p>
            <veda-if condition="true">
              <span>Inside framework component</span>
            </veda-if>
            <p>After</p>
          </div>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(ComponentWithFramework);
    await flushEffects();

    // Framework component should exist
    const vedaIf = component.querySelector('veda-if');
    assert(vedaIf !== null, 'Framework component should exist');

    // Should not break processing of other elements
    const paragraphs = component.querySelectorAll('p');
    assert(paragraphs.length === 2, 'Should process elements around framework component');

    cleanup();
  });

  test('Component - processes nested framework components correctly', async () => {
    class NestedFrameworkComponent extends Component(HTMLElement) {
      render() {
        return html`
          <div>
            <veda-loop items="[]">
              <span>Loop item</span>
            </veda-loop>
          </div>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(NestedFrameworkComponent);
    await flushEffects();

    const vedaLoop = component.querySelector('veda-loop');
    assert(vedaLoop !== null, 'Should create framework component');

    cleanup();
  });

  // ==================== DOM TRAVERSAL WITH COMPLEX NESTING ====================

  test('Component - traverses deeply nested components without siblings', async () => {
    class DeepChild extends Component(HTMLElement) {
      static tag = 'test-deep-child-behavioral';
      render() { return html`<em>Deep content</em>`; }
    }

    class MiddleParent extends Component(HTMLElement) {
      static tag = 'test-middle-behavioral';
      render() {
        return html`
          <section>
            <article>
              <test-deep-child-behavioral></test-deep-child-behavioral>
            </article>
          </section>
        `;
      }
    }

    class TopParent extends Component(HTMLElement) {
      static tag = 'test-top-behavioral';
      render() {
        return html`
          <div>
            <test-middle-behavioral></test-middle-behavioral>
            <aside>Sibling content</aside>
          </div>
        `;
      }
    }

    customElements.define('test-deep-child-behavioral', DeepChild);
    customElements.define('test-middle-behavioral', MiddleParent);
    customElements.define('test-top-behavioral', TopParent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-top-behavioral');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    // Wait for nested components
    const middle = component.querySelector('test-middle-behavioral');
    if (middle?.rendered) await middle.rendered;

    const deep = component.querySelector('test-deep-child-behavioral');
    if (deep?.rendered) await deep.rendered;

    // Verify all levels rendered
    assert(component.querySelector('em') !== null,
      'Should render deeply nested child');
    assert(component.querySelector('aside') !== null,
      'Should process sibling after traversing nested structure');

    container.remove();
  });

  // ==================== UNDEFINED VALUE HANDLING ====================

  test('Component - handles undefined reactive values gracefully', async () => {
    class UndefinedValueComponent extends Component(HTMLElement) {
      state = reactive({ value: undefined });
      render() {
        return html`<div data-test="{this.state.nonExistent}">Content</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(UndefinedValueComponent);
    await flushEffects();

    const div = component.querySelector('div');
    // Should use empty string for undefined values
    assert(div.getAttribute('data-test') === '',
      'Should use empty string for undefined attribute values');

    cleanup();
  });

  test('Component - handles undefined in boolean attributes', async () => {
    class UndefinedBooleanComponent extends Component(HTMLElement) {
      state = reactive({ checked: undefined });
      render() {
        return html`<input type="checkbox" checked="{this.state.nonExistent}">`;
      }
    }

    const { component, cleanup } = await createTestComponent(UndefinedBooleanComponent);
    await flushEffects();

    const input = component.querySelector('input');
    // undefined should make boolean attribute false
    assert(input.checked === false,
      'Should treat undefined as falsy for boolean attributes');

    cleanup();
  });

  test('Component - handles null reactive values in non-reactive attributes', async () => {
    class NullValueComponent extends Component(HTMLElement) {
      // No reactive state
      render() {
        return html`<div data-test="{this.nonExistentProp}">Content</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(NullValueComponent);

    const div = component.querySelector('div');
    assert(div.getAttribute('data-test') === '',
      'Should use empty string for non-existent property in non-reactive context');

    cleanup();
  });

  // ==================== EVAL CONTEXT IN NESTED COMPONENTS ====================

  test('Component - uses correct eval context in nested framework components', async () => {
    class NestedContextComponent extends Component(HTMLElement) {
      state = reactive({ show: true, message: 'Test' });
      render() {
        return html`
          <veda-if condition="{this.state.show}">
            <div data-message="{this.state.message}">Content</div>
          </veda-if>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(NestedContextComponent);
    await flushEffects();

    const div = component.querySelector('div');
    assert(div !== null, 'Should render content inside framework component');
    assert(div.getAttribute('data-message') === 'Test',
      'Should use correct eval context for attributes inside framework components');

    cleanup();
  });

  test('Component - maintains reactivity context through nested framework components', async () => {
    class ReactiveContextComponent extends Component(HTMLElement) {
      state = reactive({ show: true, isDisabled: false });
      render() {
        return html`
          <veda-if condition="{this.state.show}">
            <button disabled="{this.state.isDisabled}">Click</button>
          </veda-if>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(ReactiveContextComponent);
    await flushEffects();

    const button = component.querySelector('button');
    assert(button !== null, 'Should render button');
    assert(button.disabled === false, 'Initial state should be not disabled');

    // Change state and verify reactivity works through framework component
    component.state.isDisabled = true;
    await flushEffects();

    assert(button.disabled === true,
      'Should maintain reactivity for attributes through framework components');

    cleanup();
  });

  // ==================== BOOLEAN ATTRIBUTE EDGE CASES ====================

  test('Component - boolean attributes with empty string values', async () => {
    class EmptyStringBooleanComponent extends Component(HTMLElement) {
      value = ''; // Non-reactive empty string
      render() {
        return html`<input type="checkbox" checked="{this.value}">`;
      }
    }

    const { component, cleanup } = await createTestComponent(EmptyStringBooleanComponent);

    const input = component.querySelector('input');
    // Empty string should be treated as truthy for boolean attributes
    assert(input.checked === true,
      'Empty string should make boolean attribute truthy');

    cleanup();
  });

  test('Component - boolean attributes with attribute name as value', async () => {
    class AttributeNameValueComponent extends Component(HTMLElement) {
      disabledValue = 'disabled'; // Value equals attribute name
      render() {
        return html`<button disabled="{this.disabledValue}">Button</button>`;
      }
    }

    const { component, cleanup } = await createTestComponent(AttributeNameValueComponent);

    const button = component.querySelector('button');
    // When value equals attribute name, should be truthy
    assert(button.disabled === true,
      'Attribute name as value should make boolean attribute truthy');

    cleanup();
  });

  // ==================== PERFORMANCE TESTS ====================

  test('Component - renders simple template within performance budget', async () => {
    await adaptiveThreshold.initialize();

    class SimpleComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ count: 0 });
      }

      render() {
        // Simple template, not 100 items (too complex for performance test)
        return html`
          <div>
            <p>Count: {this.state.count}</p>
            <button>Click</button>
          </div>
        `;
      }
    }

    const threshold = adaptiveThreshold.getThreshold(100);
    const start = performance.now();
    const { component, cleanup } = await createTestComponent(SimpleComponent);
    await flushEffects();
    const duration = performance.now() - start;

    assert(component.querySelector('p') !== null, 'Should render paragraph');
    assert(component.querySelector('button') !== null, 'Should render button');
    assert(duration < threshold,
      `Simple render took ${duration.toFixed(2)}ms, threshold: ${threshold.toFixed(2)}ms`);

    cleanup();
  });

  test('Component - reactive updates complete within performance budget', async () => {
    await adaptiveThreshold.initialize();

    class ReactiveUpdateComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ count: 0 });
      }
      render() {
        return html`<div>{this.state.count}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(ReactiveUpdateComponent);
    await flushEffects();

    const threshold = adaptiveThreshold.getThreshold(500);
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      component.state.count = i;
    }
    await flushEffects();
    const duration = performance.now() - start;

    assert(component.querySelector('div').textContent === '99',
      'Should have final value');
    assert(duration < threshold,
      `100 batched updates took ${duration.toFixed(2)}ms, threshold: ${threshold.toFixed(2)}ms`);

    cleanup();
  });

  test('Component - handles multiple reactive expressions efficiently', async () => {
    await adaptiveThreshold.initialize();

    class MultiExpressionComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = reactive({ a: 1, b: 2, c: 3, d: 4, e: 5 });
      }
      render() {
        return html`
          <div>
            <span>{this.state.a}</span>
            <span>{this.state.b}</span>
            <span>{this.state.c}</span>
            <span>{this.state.d}</span>
            <span>{this.state.e}</span>
          </div>
        `;
      }
    }

    const threshold = adaptiveThreshold.getThreshold(100);
    const start = performance.now();
    const { component, cleanup } = await createTestComponent(MultiExpressionComponent);
    await flushEffects();
    const duration = performance.now() - start;

    const spans = component.querySelectorAll('span');
    assert(spans.length === 5, 'Should render all spans');
    assert(duration < threshold,
      `Multiple expressions took ${duration.toFixed(2)}ms, threshold: ${threshold.toFixed(2)}ms`);

    cleanup();
  });

  // ==================== ERROR RECOVERY ====================

  test('Component - recovers from render errors and can re-render', async () => {
    let shouldThrow = true;

    class ErrorRecoveryComponent extends Component(HTMLElement) {
      state = reactive({ value: 'test' });
      render() {
        if (shouldThrow) {
          throw new Error('Intentional render error');
        }
        return html`<div>{this.state.value}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(ErrorRecoveryComponent);

    assert(component.innerHTML === '', 'Should have empty content after error');
    assert(component.isConnected, 'Should remain connected despite error');

    // Now allow successful render
    shouldThrow = false;
    await component.update();
    await flushEffects();

    assert(component.querySelector('div') !== null,
      'Should recover and render successfully after error');
    assert(component.querySelector('div').textContent === 'test',
      'Should display correct content after recovery');

    cleanup();
  });

  test('Component - continues working after multiple render errors', async () => {
    let errorCount = 0;

    class MultiErrorComponent extends Component(HTMLElement) {
      state = reactive({ value: 0 });
      render() {
        if (this.state.value < 3) {
          errorCount++;
          throw new Error(`Error ${errorCount}`);
        }
        return html`<div>Success: {this.state.value}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(MultiErrorComponent);

    // Try multiple times with errors
    component.state.value = 1;
    await flushEffects();
    await component.update();

    component.state.value = 2;
    await flushEffects();
    await component.update();

    // Finally succeed
    component.state.value = 3;
    await flushEffects();
    await component.update();

    assert(errorCount === 3, 'Should have attempted 3 renders with errors');
    assert(component.textContent.includes('Success: 3'),
      'Should eventually succeed after multiple errors');

    cleanup();
  });

};


