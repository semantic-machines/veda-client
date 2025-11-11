import { reactive } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';
import IfComponentFunc, { If } from '../src/components/IfComponent.js';
import Component, { html } from '../src/components/Component.js';
import '../test/setup-dom.js';

export default ({ test, assert }) => {

  test('If component - module exports correctly', () => {
    assert.ok(IfComponentFunc, 'IfComponent function should be exported as default');
    assert.ok(typeof IfComponentFunc === 'function', 'IfComponentFunc should be a function');
    assert.ok(If, 'If should be exported');
  });

  test('If component - can be instantiated with mock', () => {
    class MockElement {
      constructor() {
        this.childNodes = [];
      }
      querySelector() { return null; }
      querySelectorAll() { return []; }
      appendChild(node) {
        this.childNodes.push(node);
        return node;
      }
      removeChild(node) {
        const index = this.childNodes.indexOf(node);
        if (index > -1) this.childNodes.splice(index, 1);
      }
      getAttribute() { return null; }
      setAttribute() {}
      remove() {}
    }

    const IfClass = IfComponentFunc(MockElement);
    const instance = new IfClass();

    // Verify critical methods exist
    assert.ok(typeof instance.connectedCallback === 'function', 'connectedCallback should exist');
    assert.ok(typeof instance.disconnectedCallback === 'function', 'disconnectedCallback should exist');
    assert.ok(typeof instance.render === 'function', 'render should exist');
  });

  test('Reactive effects work correctly (If component depends on this)', async () => {
    // Test that effects work properly (this is what If component relies on)
    const state = reactive({ count: 0 });
    let runCount = 0;

    const stopEffect = effect(() => {
      const _ = state.count;
      runCount++;
    });

    await flushEffects();
    assert.equal(runCount, 1, 'Effect should run once initially');

    state.count++;
    await flushEffects();
    assert.equal(runCount, 2, 'Effect should run again on change');

    // Stop the effect
    stopEffect();

    state.count++;
    await flushEffects();
    assert.equal(runCount, 2, 'Effect should not run after being stopped');
  });

  test('Reactive state changes are properly tracked', async () => {
    const state = reactive({ visible: true });
    let changes = [];

    effect(() => {
      changes.push(state.visible);
    });

    await flushEffects();
    assert.equal(changes.length, 1, 'Should have one initial change');
    assert.equal(changes[0], true, 'Initial value should be true');

    state.visible = false;
    await flushEffects();
    assert.equal(changes.length, 2, 'Should have two changes');
    assert.equal(changes[1], false, 'Second value should be false');
  });

  test('IfComponent - hides and restores content when condition toggles', async () => {
    class IfToggleComponent extends Component(HTMLElement) {
      static tag = 'test-if-toggle';

      constructor() {
        super();
        this.state = this.reactive({ show: true });
      }

      render() {
        return html`
          <veda-if condition="{this.state.show}">
            <span class="content">Conditional content</span>
          </veda-if>
        `;
      }
    }

    if (!customElements.get('test-if-toggle')) {
      customElements.define('test-if-toggle', IfToggleComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-if-toggle');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const ifElement = component.querySelector('veda-if');
    let content = component.querySelector('.content');
    assert.ok(content, 'Content should be rendered while condition is true');

    component.state.show = false;
    await flushEffects();

    content = component.querySelector('.content');
    assert.equal(content, null, 'Content should be removed when condition becomes false');

    const placeholder = Array.from(ifElement.childNodes).find((node) => node.nodeType === Node.COMMENT_NODE);
    assert.ok(placeholder && placeholder.nodeValue === 'veda-if', 'Placeholder comment should be inserted when hidden');

    component.state.show = true;
    await flushEffects();

    content = component.querySelector('.content');
    assert.ok(content, 'Content should be restored when condition becomes true again');

    container.remove();
  });

  test('IfComponent - handles missing parent context', async () => {
    // Tests line 97: return false when no parent context
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (...args) => { warnMessage = args.join(' '); };

    // Use already registered veda-if or create new one
    const tagName = customElements.get('veda-if') ? 'veda-if' : 'veda-if-orphan2';

    if (!customElements.get(tagName)) {
      const IfClass = IfComponentFunc(HTMLElement);
      customElements.define(tagName, IfClass);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    // Create If without parent Component
    const ifEl = document.createElement(tagName);
    ifEl.setAttribute('condition', '{this.someValue}');
    ifEl.innerHTML = '<span>Content</span>';
    container.appendChild(ifEl);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should warn about missing parent
    assert.ok(warnMessage.includes('Cannot find parent'), 'Should warn about missing parent (line 97)');

    console.warn = originalWarn;
    container.remove();
  });

  test('IfComponent - handles expression evaluation error', async () => {
    // Tests lines 102-104: catch error in evaluate
    const originalError = console.error;
    let errorMessage = '';
    console.error = (...args) => { errorMessage = args.join(' '); };

    // Use already registered veda-if or create new one
    const tagName = customElements.get('veda-if') ? 'veda-if' : 'veda-if-errortest2';

    if (!customElements.get(tagName)) {
      const IfClass = IfComponentFunc(HTMLElement);
      customElements.define(tagName, IfClass);
    }

    class ErrorTestComponent extends Component(HTMLElement) {
      static tag = 'test-if-eval-error2';

      render() {
        // Invalid expression
        return html`
          <div>
            <${tagName} condition="{this.nonExistent.deeply.nested}">
              <span>Content</span>
            </${tagName}>
          </div>
        `;
      }
    }

    if (!customElements.get('test-if-eval-error2')) {
      customElements.define('test-if-eval-error2', ErrorTestComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-if-eval-error2');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should log error
    assert.ok(errorMessage.includes('Failed to evaluate'), 'Should log evaluation error (lines 102-104)');

    console.error = originalError;
    container.remove();
  });

  test('IfComponent - handles missing condition attribute (lines 67-69)', async () => {
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (...args) => { warnMessage = args.join(' '); };

    const tagName = customElements.get('veda-if') ? 'veda-if' : 'veda-if-nocond';
    
    if (!customElements.get(tagName)) {
      const IfClass = IfComponentFunc(HTMLElement);
      customElements.define(tagName, IfClass);
    }

    class NoConditionComponent extends Component(HTMLElement) {
      static tag = 'test-if-no-condition';

      render() {
        return html`
          <div>
            <${tagName}>
              <span>Content without condition</span>
            </${tagName}>
          </div>
        `;
      }
    }

    if (!customElements.get('test-if-no-condition')) {
      customElements.define('test-if-no-condition', NoConditionComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-if-no-condition');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    assert.ok(warnMessage.includes('requires "condition" attribute'), 'Should warn about missing condition attribute');

    console.warn = originalWarn;
    container.remove();
  });
};
