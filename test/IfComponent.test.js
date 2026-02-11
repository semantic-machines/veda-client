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
        this.state.show = true;
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
    // Tests line 87-89: return false when no parent context (content not shown)

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

    // Without parent context, condition returns false, so content should not be shown
    assert.strictEqual(ifEl.querySelector('span'), null, 'Content should not be shown without parent context');

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

  // ==================== If inside Loop ====================

  test('IfComponent - safe expression accesses loop variable inside Loop', async () => {
    class IfInLoopSafeComponent extends Component(HTMLElement) {
      static tag = 'test-if-in-loop-safe';

      constructor() {
        super();
        this.state.items = [
          { id: 1, name: 'Active', active: true },
          { id: 2, name: 'Inactive', active: false },
          { id: 3, name: 'Also Active', active: true },
        ];
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" as="item" key="id">
            <div class="row">
              <span class="name">{item.name}</span>
              <veda-if condition="{item.active}">
                <span class="badge">ON</span>
              </veda-if>
            </div>
          </veda-loop>
        `;
      }
    }

    if (!customElements.get('test-if-in-loop-safe')) {
      customElements.define('test-if-in-loop-safe', IfInLoopSafeComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-if-in-loop-safe');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const rows = component.querySelectorAll('.row');
    assert.strictEqual(rows.length, 3, 'Should render 3 rows');

    // Item 1: active=true → badge shown
    assert.ok(rows[0].querySelector('.badge'), 'Active item should show badge');
    assert.strictEqual(rows[0].querySelector('.badge').textContent, 'ON');

    // Item 2: active=false → no badge
    assert.strictEqual(rows[1].querySelector('.badge'), null, 'Inactive item should NOT show badge');

    // Item 3: active=true → badge shown
    assert.ok(rows[2].querySelector('.badge'), 'Second active item should show badge');

    container.remove();
  });

  test('IfComponent - unsafe expression accesses loop variable inside Loop', async () => {
    class IfInLoopUnsafeComponent extends Component(HTMLElement) {
      static tag = 'test-if-in-loop-unsafe';

      constructor() {
        super();
        this.state.items = [
          { id: 1, name: 'Pass', score: 80 },
          { id: 2, name: 'Fail', score: 30 },
        ];
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" as="item" key="id">
            <div class="row">
              <span class="name">{item.name}</span>
              <veda-if condition="!{item.score >= 50}">
                <span class="pass">PASSED</span>
              </veda-if>
            </div>
          </veda-loop>
        `;
      }
    }

    if (!customElements.get('test-if-in-loop-unsafe')) {
      customElements.define('test-if-in-loop-unsafe', IfInLoopUnsafeComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-if-in-loop-unsafe');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const rows = component.querySelectorAll('.row');
    assert.strictEqual(rows.length, 2, 'Should render 2 rows');

    assert.ok(rows[0].querySelector('.pass'), 'Score 80 should show PASSED');
    assert.strictEqual(rows[1].querySelector('.pass'), null, 'Score 30 should NOT show PASSED');

    container.remove();
  });

  test('IfComponent - content inside If accesses loop variable', async () => {
    class IfContentLoopVarComponent extends Component(HTMLElement) {
      static tag = 'test-if-content-loopvar';

      constructor() {
        super();
        this.state.items = [
          { id: 1, name: 'Alice', admin: true },
          { id: 2, name: 'Bob', admin: false },
        ];
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" as="user" key="id">
            <div class="row">
              <veda-if condition="{user.admin}">
                <span class="admin-name">{user.name}</span>
              </veda-if>
            </div>
          </veda-loop>
        `;
      }
    }

    if (!customElements.get('test-if-content-loopvar')) {
      customElements.define('test-if-content-loopvar', IfContentLoopVarComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-if-content-loopvar');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const rows = component.querySelectorAll('.row');

    // Alice: admin=true → name rendered inside If
    const adminName = rows[0].querySelector('.admin-name');
    assert.ok(adminName, 'Admin user should have name rendered');
    assert.strictEqual(adminName.textContent, 'Alice', 'Should render loop variable inside If body');

    // Bob: admin=false → nothing rendered
    assert.strictEqual(rows[1].querySelector('.admin-name'), null, 'Non-admin should not show name');

    container.remove();
  });

  test('IfComponent - reactively toggles inside Loop when item changes', async () => {
    class IfReactiveInLoopComponent extends Component(HTMLElement) {
      static tag = 'test-if-reactive-in-loop';

      constructor() {
        super();
        this.state.items = [
          { id: 1, name: 'Task', done: false },
        ];
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" as="task" key="id">
            <div class="row">
              <veda-if condition="{task.done}">
                <span class="done-marker">DONE</span>
              </veda-if>
            </div>
          </veda-loop>
        `;
      }
    }

    if (!customElements.get('test-if-reactive-in-loop')) {
      customElements.define('test-if-reactive-in-loop', IfReactiveInLoopComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-if-reactive-in-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    // Initially done=false → no marker
    assert.strictEqual(component.querySelector('.done-marker'), null, 'Should not show marker initially');

    // Update item: done=true
    component.state.items = [{ id: 1, name: 'Task', done: true }];
    await flushEffects();

    assert.ok(component.querySelector('.done-marker'), 'Should show marker after item becomes done');

    container.remove();
  });

  test('IfComponent - If also accesses parent state inside Loop', async () => {
    class IfParentStateInLoopComponent extends Component(HTMLElement) {
      static tag = 'test-if-parent-state-loop';

      constructor() {
        super();
        this.state.showDetails = true;
        this.state.items = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ];
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" as="item" key="id">
            <div class="row">
              <span class="name">{item.name}</span>
              <veda-if condition="{this.state.showDetails}">
                <span class="detail">Details for {item.name}</span>
              </veda-if>
            </div>
          </veda-loop>
        `;
      }
    }

    if (!customElements.get('test-if-parent-state-loop')) {
      customElements.define('test-if-parent-state-loop', IfParentStateInLoopComponent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-if-parent-state-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const details = component.querySelectorAll('.detail');
    assert.strictEqual(details.length, 2, 'Both items should show details when parent state is true');

    // Parent state also accessible inside If body with loop variable
    assert.ok(details[0].textContent.includes('Item 1'), 'Detail should contain loop variable value');
    assert.ok(details[1].textContent.includes('Item 2'), 'Detail should contain loop variable value');

    // Toggle parent state
    component.state.showDetails = false;
    await flushEffects();

    assert.strictEqual(component.querySelectorAll('.detail').length, 0, 'Details should hide when parent state is false');

    container.remove();
  });
};
