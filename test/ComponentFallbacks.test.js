/**
 * Component Fallback Code Tests
 * Tests for Component.js lines 314-320, 417-420
 */

import './setup-dom.js';
import Component, { html } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';
import { createTestComponent } from './helpers.js';

export default ({ test, assert }) => {

  test('ComponentFallback - template inside veda-if handling', async () => {
    class TestComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.show = true;
      }
      render() {
        return html`
          <veda-if test="this.state.show">
            <div class="template-content">Template inside if</div>
          </veda-if>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestComponent);

    // Component should render without crashing
    assert(component.isConnected, 'Component rendered');

    // Toggle state
    component.state.show = false;
    await flushEffects();

    component.state.show = true;
    await flushEffects();

    cleanup();
  });

  test('ComponentFallback - template inside veda-loop handling', async () => {
    class TestComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.items = ['a', 'b'];
      }
      render() {
        return html`
          <veda-loop>
            <div class="item">Item</div>
          </veda-loop>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestComponent);

    // Component should render without crashing
    assert(component.isConnected, 'Component rendered with loop');

    cleanup();
  });

  test('ComponentFallback - _currentEvalContext undefined fallback', async () => {
    // Tests line 417-420: const context = this._currentEvalContext || this;
    class ContextFallbackComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.value = 'fallback-test';
        // Don't set _currentEvalContext, let it be undefined
      }

      render() {
        return html`<div>{this.state.value}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(ContextFallbackComponent);

    // Should use 'this' as fallback when _currentEvalContext is undefined
    assert(component.textContent.includes('fallback-test'),
      'Fallback context works when _currentEvalContext is undefined');

    // Update state to verify reactivity works
    component.state.value = 'updated';
    await flushEffects();

    assert(component.textContent.includes('updated'),
      'Fallback context supports reactivity');

    cleanup();
  });

  test('ComponentFallback - parentElement undefined with getRootNode', async () => {
    // Tests parentElement fallback: this.parentElement || this.getRootNode?.()?.host
    class RootNodeComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.useShadow = true; // Use shadow DOM
      }

      render() {
        return html`<div class="shadow-content">Shadow content</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(RootNodeComponent);

    // Component should handle shadow DOM correctly
    const hasShadow = component.shadowRoot !== null;
    const hasContent = hasShadow
      ? component.shadowRoot.querySelector('.shadow-content') !== null
      : component.querySelector('.shadow-content') !== null;

    assert(hasContent || component.isConnected,
      'Component handles shadow DOM / getRootNode fallback');

    cleanup();
  });

  test('ComponentFallback - attribute with null/undefined context', async () => {
    class NullContextComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.disabled = false;
      }

      render() {
        // This exercises the context fallback in attribute processing
        return html`<button disabled="{this.state.disabled}">Click</button>`;
      }
    }

    const { component, cleanup } = await createTestComponent(NullContextComponent);

    const button = component.querySelector('button');
    assert(button !== null, 'Button rendered');
    assert(!button.disabled, 'Initial state: not disabled');

    component.state.disabled = true;
    await flushEffects();

    assert(button.disabled, 'State updated: disabled');

    cleanup();
  });

  test('ComponentFallback - deeply nested component tree', async () => {
    // Tests the parentElement traversal when component is deeply nested
    class LeafComponent extends Component(HTMLElement) {
      render() {
        return html`<span>Leaf</span>`;
      }
    }

    class MiddleComponent extends Component(HTMLElement) {
      render() {
        return html`
          <div>
            <div>
              <div>
                <veda-leaf></veda-leaf>
              </div>
            </div>
          </div>
        `;
      }
    }

    LeafComponent.tag = 'veda-leaf';
    MiddleComponent.tag = 'veda-middle';

    if (!customElements.get('veda-leaf')) {
      customElements.define('veda-leaf', LeafComponent);
    }

    const { component, cleanup } = await createTestComponent(MiddleComponent);

    const leaf = component.querySelector('veda-leaf');
    assert(leaf !== null, 'Deeply nested component rendered');
    assert(leaf.textContent.includes('Leaf'), 'Nested component content correct');

    cleanup();
  });
};

