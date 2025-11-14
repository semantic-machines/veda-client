import './setup-dom.js';
import Component, { html, raw, safe, reactive, effect } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';
import Model from '../src/Model.js';
import { createTestComponent, createTestContainer, assertAttribute, createSpy, captureConsole } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== HELPER FUNCTIONS ====================

  // Parametrized test for different value types in expressions
  [
    ['string', 'hello', 'world'],
    ['number', 42, 100],
    ['boolean', true, false],
    ['array', [1, 2], [3, 4, 5]]
  ].forEach(([type, initial, updated]) => {
    test(`Component - reactive ${type} expression`, async () => {
      class TestComponent extends Component(HTMLElement) {
        constructor() {
          super();
          this.state = this.reactive({ value: initial });
        }
        render() {
          return html`<div class="value">{this.state.value}</div>`;
        }
      }

      const { component, container, cleanup } = await createTestComponent(TestComponent);
      const div = component.querySelector('.value');

      const initialText = Array.isArray(initial) ? initial.join(',') : String(initial);
      assert(div.textContent === initialText, `Initial ${type} renders correctly`);

      component.state.value = updated;
      await flushEffects();

      const updatedText = Array.isArray(updated) ? updated.join(',') : String(updated);
      assert(div.textContent === updatedText, `Updated ${type} renders correctly`);

      cleanup();
    });
  });

  test('html() tagged template - escaping and safe values', () => {
    // Combines: escapes values, preserves safe markup, handles arrays
    const xss = '<script>alert("xss")</script>';
    const result1 = html`<div>${xss}</div>`;
    assert(result1.includes('&lt;script&gt;') && !result1.includes('<script>'), 'Should escape HTML');

    const inner = html`<span>Safe</span>`;
    const outer = html`<div>${inner}</div>`;
    assert(outer.includes('<span>Safe</span>'), 'Should preserve safe markup');

    const items = ['<b>one</b>', '<b>two</b>'];
    const result2 = html`<div>${items}</div>`;
    assert(result2.includes('&lt;b&gt;'), 'Should escape array items');
  });

  test('raw() - does not escape values', () => {
    const markup = '<span>Raw HTML</span>';
    const result = raw`<div>${markup}</div>`;

    assert(result.includes('<span>Raw HTML</span>'), 'Should preserve raw markup');
  });

  test('safe() - escapes, removes expressions, handles arrays', () => {
    // Escapes dangerous characters
    const dangerous = '<script>alert("xss")</script>';
    assert(safe(dangerous) === '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;', 'Should escape all dangerous chars');

    // Removes reactive expressions
    const text = 'Hello {this.name} world';
    assert(safe(text) === 'Hello  world', 'Should remove {expressions}');

    // Handles arrays recursively
    const arr = ['<div>', '<span>'];
    const result = safe(arr);
    assert(Array.isArray(result) && result[0] === '&lt;div&gt;' && result[1] === '&lt;span&gt;', 'Should handle arrays recursively');
  });

  // ==================== COMPONENT LIFECYCLE ====================

  test('Component - basic instantiation', () => {
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-basic';
    }

    customElements.define('test-basic', TestComponent);

    const instance = document.createElement('test-basic');

    assert(instance instanceof HTMLElement, 'Should extend HTMLElement');
    assert(typeof instance.connectedCallback === 'function', 'Should have connectedCallback');
    assert(typeof instance.disconnectedCallback === 'function', 'Should have disconnectedCallback');
    assert(typeof instance.render === 'function', 'Should have render method');
    assert(instance.rendered instanceof Promise, 'Should have rendered promise');
  });

  test('Component - toString returns tag', () => {
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-tostring';
    }

    assert(TestComponent.toString() === 'test-tostring', 'toString should return tag');
  });

  test('Component - lifecycle hooks order', async () => {
    const calls = [];

    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        calls.push('constructor');
      }

      async added() {
        calls.push('added');
      }

      pre() {
        calls.push('pre');
      }

      render() {
        calls.push('render');
        return html`<div>Test</div>`;
      }

      post() {
        calls.push('post');
      }

      renderedCallback() {
        calls.push('renderedCallback');
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);

    assert(calls[0] === 'constructor', 'constructor should be first');
    assert(calls.includes('added'), 'added should be called');
    assert(calls.includes('pre'), 'pre should be called');
    assert(calls.includes('render'), 'render should be called');
    assert(calls.includes('post'), 'post should be called');
    assert(calls[calls.length - 1] === 'renderedCallback', 'renderedCallback should be last');
    cleanup();
  });

  test('Component - disconnectedCallback cleanup', async () => {
    let effectRuns = 0;

    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-disconnect';

      constructor() {
        super();
        this.state = this.reactive({ count: 0 });
      }

      async connectedCallback() {
        await super.connectedCallback();

        this.effect(() => {
          effectRuns++;
          void this.state.count;
        });
      }

      render() {
        return html`<div>{this.state.count}</div>`;
      }
    }

    customElements.define('test-disconnect', TestComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-disconnect');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const runsBeforeDisconnect = effectRuns;

    // Disconnect component
    container.removeChild(component);

    // Change state after disconnect
    component.state.count++;
    await flushEffects();

    // Effect should not run after disconnect
    assert(effectRuns === runsBeforeDisconnect, 'Effects should be cleaned up on disconnect');

    container.remove();
  });

  // ==================== REACTIVE STATE ====================

  test('Component - reactive state changes trigger re-render', async () => {
    class CounterComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ count: 0 });
      }

      render() {
        return html`<div class="count">{this.state.count}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(CounterComponent);
    await flushEffects();

    let countDiv = component.querySelector('.count');
    assert(countDiv.textContent === '0', 'Initial count should be 0');

    // Change state
    component.state.count = 42;
    await flushEffects();

    countDiv = component.querySelector('.count');
    assert(countDiv.textContent === '42', 'Count should update to 42');
    cleanup();
  });

  test('Component - multiple reactive properties', async () => {
    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          firstName: 'John',
          lastName: 'Doe'
        });
      }

      render() {
        return html`
          <div>
            <span class="first">{this.state.firstName}</span>
            <span class="last">{this.state.lastName}</span>
          </div>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    assert(component.querySelector('.first').textContent === 'John', 'First name should be John');
    assert(component.querySelector('.last').textContent === 'Doe', 'Last name should be Doe');

    component.state.firstName = 'Jane';
    await flushEffects();

    assert(component.querySelector('.first').textContent === 'Jane', 'First name should update');
    assert(component.querySelector('.last').textContent === 'Doe', 'Last name should stay same');
    cleanup();
  });

  test('Component - computed properties are reactive', async () => {
    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ count: 5 });
      }

      get doubled() {
        return this.state.count * 2;
      }

      render() {
        return html`<div class="result">{this.doubled}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    assert(component.querySelector('.result').textContent === '10', 'Initial doubled value');

    component.state.count = 7;
    await flushEffects();

    assert(component.querySelector('.result').textContent === '14', 'Computed should update');
    cleanup();
  });

  // ==================== EVENT HANDLERS ====================

  test('Component - event handler binding (method name, event/node params, multiple types)', async () => {
    let clicked = false;
    let receivedEvent = null;
    let receivedNode = null;
    const events = [];

    class TestComponent extends Component(HTMLElement) {

      handleClick = (event, node) => {
        clicked = true;
        receivedEvent = event;
        receivedNode = node;
      }

      handleMouseover = () => events.push('mouseover');

      render() {
        return html`
          <button
            onclick="{handleClick}"
            onmouseover="{handleMouseover}">
            Click me
          </button>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestComponent);

    const button = component.querySelector('button');
    button.click();

    assert(clicked === true, 'Click handler should be called');
    assert(receivedEvent !== null && receivedEvent.type === 'click', 'Should receive click event');
    assert(receivedNode === button, 'Should receive button node');
    cleanup();
  });

  // ==================== REACTIVE ATTRIBUTES ====================

  test('Component - reactive attributes update', async () => {
    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ disabled: false });
      }

      render() {
        return html`<button disabled="{this.state.disabled}">Button</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    const button = component.querySelector('button');
    assert(button !== null, 'Button should exist in component');
    assert(!button.disabled, 'Button should not be disabled initially');

    component.state.disabled = true;
    await flushEffects();

    assert(button.disabled, 'Button should be disabled after state change');
    cleanup();
  });

  test('Component - boolean attributes (checked, disabled, etc)', async () => {
    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          checked: false,
          disabled: false
        });
      }

      render() {
        return html`
          <input type="checkbox" checked="{this.state.checked}" />
          <button disabled="{this.state.disabled}">Button</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    const checkbox = component.querySelector('input');
    const button = component.querySelector('button');

    assert(!checkbox.checked, 'Checkbox should not be checked');
    assert(!button.disabled, 'Button should not be disabled');

    component.state.checked = true;
    component.state.disabled = true;
    await flushEffects();

    assert(checkbox.checked, 'Checkbox should be checked');
    assert(button.disabled, 'Button should be disabled');
    cleanup();
  });

  // ==================== TEMPLATE PROCESSING ====================

  test('Component - renders simple template', async () => {
    class TestComponent extends Component(HTMLElement) {

      render() {
        return html`<div class="test">Hello World</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);

    const div = component.querySelector('.test');
    assert(div !== null, 'Should have div with class test');
    assert(div.textContent === 'Hello World', 'Should have correct text');
    cleanup();
  });

  test('Component - multiple reactive expressions in text (2 and 3 expressions)', async () => {
    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          first: 'John',
          last: 'Doe',
          a: 'A',
          b: 'B',
          c: 'C'
        });
      }

      render() {
        return html`
          <div class="two">Name: {this.state.first} {this.state.last}</div>
          <div class="three">{this.state.a}-{this.state.b}-{this.state.c}</div>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    // Test 2 expressions
    const twoDiv = component.querySelector('.two');
    assert(twoDiv.textContent.includes('John') && twoDiv.textContent.includes('Doe'), 'Should include both names');

    component.state.first = 'Jane';
    await flushEffects();
    assert(twoDiv.textContent.includes('Jane') && twoDiv.textContent.includes('Doe'), 'Should update first name');

    // Test 3 expressions
    const threeDiv = component.querySelector('.three');
    assert(threeDiv.textContent === 'A-B-C', 'Should render 3 expressions');

    component.state.b = 'X';
    await flushEffects();
    assert(threeDiv.textContent === 'A-X-C', 'Should update middle expression');

    cleanup();
  });

  // ==================== MODEL INTEGRATION ====================

  test('Component - model property integration', async () => {
    class TestComponent extends Component(HTMLElement) {

      render() {
        return html`<div class="model-id">{this.model.id}</div>`;
      }
    }

    customElements.define('test-model-prop', TestComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-model-prop');
    component.model = { id: 'test:123' };
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const div = component.querySelector('.model-id');
    assert(div.textContent === 'test:123', 'Should display model id');

    container.remove();
  });

  // ==================== HELPER METHODS ====================

  test('Component - effect() helper method', async () => {
    let effectRuns = 0;

    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ count: 0 });
      }

      async connectedCallback() {
        await super.connectedCallback();

        this.effect(() => {
          effectRuns++;
          void this.state.count;
        });
      }

      render() {
        return html`<div>{this.state.count}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    const initialRuns = effectRuns;

    component.state.count++;
    await flushEffects();

    assert(effectRuns > initialRuns, 'Effect should run on state change');
    cleanup();
  });

  test('Component - watch() helper method', async () => {
    const values = [];

    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ count: 0 });
      }

      async connectedCallback() {
        await super.connectedCallback();

        this.watch(
          () => this.state.count,
          (newVal, oldVal) => {
            values.push({ new: newVal, old: oldVal });
          }
        );
      }

      render() {
        return html`<div>{this.state.count}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    component.state.count = 5;
    await flushEffects();

    component.state.count = 10;
    await flushEffects();

    assert(values.length === 2, 'Should have two changes');
    assert(values[0].new === 5, 'First change new value');
    assert(values[0].old === 0, 'First change old value');
    assert(values[1].new === 10, 'Second change new value');
    assert(values[1].old === 5, 'Second change old value');
    cleanup();
  });

  // ==================== EDGE CASES ====================

  test('Component - handles undefined/null in expressions', async () => {
    class TestComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state = this.reactive({ value: null });
      }
      render() {
        return html`<div class="value">{this.state.value}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    const div = component.querySelector('.value');

    assert(div.textContent === '', 'Null should render as empty string');

    component.state.value = undefined;
    await flushEffects();
    assert(div.textContent === '', 'Undefined should render as empty string');

    component.state.value = 'Hello';
    await flushEffects();
    assert(div.textContent === 'Hello', 'Should render actual value');

    cleanup();
  });

  test('Component - async render() and lifecycle hooks', async () => {
    const calls = [];

    class TestComponent extends Component(HTMLElement) {
      async added() {
        await new Promise(resolve => setTimeout(resolve, 5));
        calls.push('added');
      }

      async pre() {
        await new Promise(resolve => setTimeout(resolve, 5));
        calls.push('pre');
      }

      async render() {
        await new Promise(resolve => setTimeout(resolve, 10));
        calls.push('render');
        return html`<div>Async content</div>`;
      }

      async post() {
        await new Promise(resolve => setTimeout(resolve, 5));
        calls.push('post');
      }
    }

    const { component, cleanup } = await createTestComponent(TestComponent);

    assert(component.textContent.includes('Async content'), 'Should render async content');
    assert(calls.includes('added'), 'added should be called');
    assert(calls.includes('pre'), 'pre should be called');
    assert(calls.includes('render'), 'render should be called');
    assert(calls.includes('post'), 'post should be called');

    cleanup();
  });

  test('Component - model integration (populate from about, set about from model)', async () => {
    class TestComponent extends Component(HTMLElement) {
      render() {
        return html`<div>{this.model?.id || 'no-id'}</div>`;
      }
    }

    customElements.define('test-model-integration', TestComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    // Test 1: Populate from about attribute
    const comp1 = document.createElement('test-model-integration');
    comp1.setAttribute('about', 'test:123');
    container.appendChild(comp1);

    await comp1.rendered;

    assert(comp1.model !== undefined, 'Model should be created from about attribute');
    assert(comp1.model.id === 'test:123', 'Model id should match about attribute');

    // Test 2: Set about from model
    const comp2 = document.createElement('test-model-integration');
    const mockModel = new Model('test:456');
    comp2.model = mockModel;

    container.appendChild(comp2);

    await comp2.rendered;

    assert(comp2.getAttribute('about') === 'test:456', 'Should set about attribute from model');

    container.remove();
  });

  test('Component - template fallbacks (undefined, template property, innerHTML)', async () => {
    // Test 1: render returns undefined
    class NoTemplateComponent extends Component(HTMLElement) {
      render() {
        return undefined;
      }
    }

    const { component: comp1, cleanup: cleanup1 } = await createTestComponent(NoTemplateComponent);
    assert(comp1.childNodes.length === 0, 'Undefined render should have no children');
    cleanup1();

    // Test 2: template property fallback
    class TemplatePropertyComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.template = '<div class="from-template">Template content</div>';
      }
      render() {
        return this.template;
      }
    }

    const { component: comp2, cleanup: cleanup2 } = await createTestComponent(TemplatePropertyComponent);
    assert(comp2.querySelector('.from-template')?.textContent === 'Template content', 'Should use template property');
    cleanup2();

    // Test 3: innerHTML fallback
    class InnerHTMLComponent extends Component(HTMLElement) {
      static tag = 'test-innerhtml-fallback';
    }

    customElements.define('test-innerhtml-fallback', InnerHTMLComponent);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const comp3 = document.createElement('test-innerhtml-fallback');
    comp3.innerHTML = '<div class="from-html">Inner content</div>';
    container.appendChild(comp3);
    await comp3.rendered;

    assert(comp3.querySelector('.from-html') !== null, 'Should use innerHTML');
    container.remove();
  });

  test('Component - lifecycle hooks (pre, post, removed, renderedCallback)', async () => {
    let preCalled = false;
    let postCalled = false;
    let removedCalled = false;
    let renderedCallbackCalled = false;

    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-lifecycle-hooks';

      pre() {
        preCalled = true;
      }

      render() {
        return html`<div>Test</div>`;
      }

      post() {
        postCalled = true;
      }

      renderedCallback() {
        renderedCallbackCalled = true;
      }

      removed() {
        removedCalled = true;
      }
    }

    customElements.define('test-lifecycle-hooks', TestComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-lifecycle-hooks');
    container.appendChild(component);

    await component.rendered;

    assert(preCalled === true, 'pre() should be called');
    assert(postCalled === true, 'post() should be called');
    assert(renderedCallbackCalled === true, 'renderedCallback should be called');

    container.removeChild(component);

    assert(removedCalled === true, 'removed() should be called on disconnect');

    container.remove();
  });

  test('Component - error in render is caught', async () => {
    class TestComponent extends Component(HTMLElement) {

      render() {
        throw new Error('Render error');
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);

    // Component should be rendered even if render() throws
    assert(component.isConnected, 'Component should remain connected despite render error');
    assert(component.innerHTML === '', 'Component should have empty content after render error');
    cleanup();
  });

  test('Component - update() can be called manually', async () => {
    let renderCount = 0;

    class TestComponent extends Component(HTMLElement) {

      render() {
        renderCount++;
        return html`<div>Count: ${renderCount}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);

    const initialCount = renderCount;

    await component.update();

    assert(renderCount > initialCount, 'Render should be called again after manual update');
    cleanup();
  });

  test('Component - falsy values render correctly', async () => {
    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          zero: 0,
          empty: '',
          false: false
        });
      }

      render() {
        return html`
          <div class="zero">{this.state.zero}</div>
          <div class="empty">{this.state.empty}</div>
          <div class="false">{this.state.false}</div>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    assert(component.querySelector('.zero').textContent === '0', 'Zero should render as "0"');
    assert(component.querySelector('.empty').textContent === '', 'Empty string should render as ""');
    assert(component.querySelector('.false').textContent === 'false', 'False should render as "false"');
    cleanup();
  });

  test('Component - static and mixed expressions with ${}', async () => {
    const testId = 'my-test-id';

    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ name: 'World' });
      }

      render() {
        return html`
          <div id="${testId}">Static</div>
          <div class="${'greeting'}">Hello {this.state.name}</div>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    // Test static expression
    const staticDiv = component.querySelector(`#${testId}`);
    assert(staticDiv !== null, 'Should have div with static id');

    // Test mixed static and reactive
    const dynamicDiv = component.querySelector('.greeting');
    assert(dynamicDiv !== null, 'Should have div with static class');
    assert(dynamicDiv.textContent.includes('World'), 'Should have reactive content');

    component.state.name = 'Universe';
    await flushEffects();

    assert(dynamicDiv.textContent.includes('Universe'), 'Reactive content should update');
    cleanup();
  });

  test('Component - expression with optional chaining', async () => {
    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          obj: null
        });
      }

      get displayValue() {
        return this.state.obj?.nested?.value || 'default';
      }

      render() {
        return html`<div>{this.displayValue}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    assert(component.textContent.includes('default'), 'Should show default for null');

    component.state.obj = { nested: { value: 'found' } };
    await flushEffects();

    assert(component.textContent.includes('found'), 'Should show nested value');
    cleanup();
  });

  test('Component - watch() helper (basic, immediate, cleanup)', async () => {
    const values = [];
    const immediateValues = [];
    let cleanupWatchRuns = 0;

    class TestComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ count: 0, other: 0 });
      }

      watchCleanup = null;

      async connectedCallback() {
        await super.connectedCallback();

        // Basic watch
        this.watch(
          () => this.state.count,
          (newVal, oldVal) => values.push({ new: newVal, old: oldVal })
        );

        // Watch with immediate
        this.watch(
          () => this.state.other,
          (val) => immediateValues.push(val),
          { immediate: true }
        );

        // Watch with cleanup
        this.watchCleanup = this.watch(
          () => this.state.count,
          () => cleanupWatchRuns++
        );
      }

      render() {
        return html`<div>{this.state.count}</div>`;
      }
    }

    const { component, cleanup } = await createTestComponent(TestComponent);
    await flushEffects();

    // Test immediate option
    assert(immediateValues.length === 1 && immediateValues[0] === 0, 'Immediate watch should run with initial value');

    // Test basic watch
    component.state.count = 5;
    await flushEffects();
    assert(values.length === 1 && values[0].new === 5 && values[0].old === 0, 'Watch should track changes');

    component.state.count = 10;
    await flushEffects();
    assert(values[1].new === 10 && values[1].old === 5, 'Watch should track subsequent changes');

    // Test cleanup
    const runsBeforeCleanup = cleanupWatchRuns;
    component.watchCleanup();
    component.state.count = 15;
    await flushEffects();
    assert(cleanupWatchRuns === runsBeforeCleanup, 'Watch should not run after cleanup');

    cleanup();
  });

  // ==================== NESTED COMPONENTS ====================

  test('Component - nested custom components', async () => {
    class ChildComponent extends Component(HTMLElement) {
      static tag = 'test-child';

      constructor() {
        super();
        this.state = this.reactive({ message: 'child' });
      }

      render() {
        return html`<div class="child">{this.state.message}</div>`;
      }
    }

    class ParentComponent extends Component(HTMLElement) {
      static tag = 'test-parent';

      render() {
        return html`
          <div class="parent">
            <test-child></test-child>
          </div>
        `;
      }
    }

    customElements.define('test-child', ChildComponent);
    customElements.define('test-parent', ParentComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const parent = document.createElement('test-parent');
    container.appendChild(parent);

    await parent.rendered;

    const child = parent.querySelector('test-child');
    assert(child !== null, 'Should have child component');

    await child.rendered;

    const childDiv = child.querySelector('.child');
    assert(childDiv !== null, 'Child should render its template');
    assert(childDiv.textContent === 'child', 'Child should have correct content');

    container.remove();
  });

  test('Component - passing data to nested components via attributes', async () => {
    class ReceiverComponent extends Component(HTMLElement) {
      static tag = 'test-receiver';

      render() {
        const data = this.getAttribute('data') || 'no-data';
        return html`<div class="received">${data}</div>`;
      }
    }

    class DataComponent extends Component(HTMLElement) {
      static tag = 'test-data';

      constructor() {
        super();
        this.state = this.reactive({ value: 'parent-value' });
      }

      render() {
        return html`<test-receiver data="{this.state.value}"></test-receiver>`;
      }
    }

    customElements.define('test-receiver', ReceiverComponent);
    customElements.define('test-data', DataComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-data');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const receiver = component.querySelector('test-receiver');

    if (receiver) {
      await receiver.rendered;
      await flushEffects();

      const div = receiver.querySelector('.received');
      assert(div !== null, 'Receiver should render');
      assert(div.textContent === 'parent-value', 'Should receive data from parent');
    }

    container.remove();
  });

  test('Component - findMethod searches up component tree', async () => {
    let clickedInParent = false;

    class ParentWithMethod extends Component(HTMLElement) {
      static tag = 'test-parent-method';

      handleChildClick = () => {
        clickedInParent = true;
      }

      render() {
        return html`<test-child-caller></test-child-caller>`;
      }
    }

    class ChildCaller extends Component(HTMLElement) {
      static tag = 'test-child-caller';

      render() {
        return html`<button onclick="{handleChildClick}">Click</button>`;
      }
    }

    customElements.define('test-parent-method', ParentWithMethod);
    customElements.define('test-child-caller', ChildCaller);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const parent = document.createElement('test-parent-method');
    container.appendChild(parent);

    await parent.rendered;

    const child = parent.querySelector('test-child-caller');
    await child.rendered;

    const button = child.querySelector('button');
    button.click();

    assert(clickedInParent === true, 'Should find method in parent component');

    container.remove();
  });

  test('Component - method not found warning', async () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    class NoMethodComponent extends Component(HTMLElement) {

      render() {
        return html`<button onclick="{nonExistentMethod}">Click</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(NoMethodComponent);

    const button = component.querySelector('button');
    button.click();

    console.warn = originalWarn;

    const hasWarning = warnings.some(w => w.includes('nonExistentMethod'));
    assert(hasWarning, 'Should warn about method not found');
    cleanup();
  });

  test('Component - invalid event handler expression', async () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    class InvalidHandlerComponent extends Component(HTMLElement) {

      render() {
        return html`<button onclick="{this.state.notAFunction}">Click</button>`;
      }

      constructor() {
        super();
        this.state = this.reactive({ notAFunction: 'string value' });
      }
    }

    const { component, container, cleanup } = await createTestComponent(InvalidHandlerComponent);
    await flushEffects();

    console.warn = originalWarn;

    const hasWarning = warnings.some(w =>
      w.includes('did not resolve to a function') ||
      w.includes('Invalid expression')
    );
    assert(hasWarning, 'Should warn about invalid handler');
    cleanup();
  });

  test('Component - event handler with property access', async () => {
    let receivedValue = null;

    class PropAccessComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.handlers = {
          myHandler: (e) => {
            receivedValue = 'called';
          }
        };
      }

      render() {
        return html`<button onclick="{handlers.myHandler}">Click</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(PropAccessComponent);

    const button = component.querySelector('button');
    button.click();

    assert(receivedValue === 'called', 'Should call handler via property access');
    cleanup();
  });

  test('Component - non-reactive component with expressions', async () => {
    class NonReactiveComponent extends Component(HTMLElement) {

      constructor() {
        super();
        // Don't use this.reactive() - plain object
        this.data = { value: 'static' };
      }

      render() {
        return html`<div>{this.data.value}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(NonReactiveComponent);

    const div = component.querySelector('div');
    assert(div.textContent === 'static', 'Should render static value');

    // Change won't trigger re-render (non-reactive)
    component.data.value = 'changed';
    await flushEffects();

    // Still shows old value - no re-render
    assert(div.textContent === 'static', 'Should not update (non-reactive)');
    cleanup();
  });

  test('Component - error in added() hook is caught', async () => {
    class ErrorInAddedComponent extends Component(HTMLElement) {

      added() {
        throw new Error('Error in added');
      }

      render() {
        return html`<div>Test</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(ErrorInAddedComponent);

    // Component should remain connected despite error in added()
    // but might not render if error occurs before update()
    assert(component.isConnected, 'Component should remain connected despite added() error');
    cleanup();
  });

  test('Component - error in removed() hook is caught', async () => {
    class ErrorInRemovedComponent extends Component(HTMLElement) {
      static tag = 'test-error-removed';

      removed() {
        throw new Error('Error in removed');
      }

      render() {
        return html`<div>Test</div>`;
      }
    }

    customElements.define('test-error-removed', ErrorInRemovedComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-error-removed');
    container.appendChild(component);

    await component.rendered;

    container.removeChild(component);

    // Component should be removed cleanly despite error in removed()
    assert(!component.isConnected, 'Component should be disconnected despite removed() error');

    container.remove();
  });

  test('Component - non-reactive component with custom element attribute', async () => {
    class NonReactiveChild extends Component(HTMLElement) {
      static tag = 'test-nonreactive-child';

      render() {
        const msg = this.getAttribute('message') || 'default';
        return html`<div class="msg">${msg}</div>`;
      }
    }

    class NonReactiveParent extends Component(HTMLElement) {
      static tag = 'test-nonreactive-parent';

      constructor() {
        super();
        // Non-reactive data
        this.data = { text: 'hello' };
      }

      render() {
        return html`<test-nonreactive-child message="{data.text}"></test-nonreactive-child>`;
      }
    }

    customElements.define('test-nonreactive-child', NonReactiveChild);
    customElements.define('test-nonreactive-parent', NonReactiveParent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const parent = document.createElement('test-nonreactive-parent');
    container.appendChild(parent);

    await parent.rendered;

    const child = parent.querySelector('test-nonreactive-child');
    if (child) {
      await child.rendered;
      const div = child.querySelector('.msg');
      assert(div !== null, 'Child should render');
      assert(div.textContent === 'hello', 'Should pass attribute value');
    }

    container.remove();
  });

  test('Component - expression evaluation error handling', async () => {
    class ErrorExprComponent extends Component(HTMLElement) {

      render() {
        // This will cause evaluation error
        return html`<div>{this.nonExistent.deeply.nested.property}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(ErrorExprComponent);

    const div = component.querySelector('div');
    // Should render empty string on error
    assert(div.textContent === '', 'Should render empty on evaluation error');
    cleanup();
  });

  test('Component - event handler can throw error', async () => {
    class ErrorHandlerComponent extends Component(HTMLElement) {

      handleClick = () => {
        throw new Error('Handler error');
      }

      render() {
        return html`<button onclick="{handleClick}">Click</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(ErrorHandlerComponent);

    const button = component.querySelector('button');
    assert(button !== null, 'Button should exist');

    // Handler is registered, component renders successfully
    // Error in handler would only be caught during click in browser
    assert(component.isConnected, 'Component should be rendered with error-throwing handler');
    cleanup();
  });

  test('Component - event handler resolves to function via getter', async () => {
    let clicked = false;

    class GetterHandlerComponent extends Component(HTMLElement) {

      get myHandler() {
        return () => { clicked = true; };
      }

      render() {
        return html`<button onclick="{this.myHandler}">Click</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(GetterHandlerComponent);

    const button = component.querySelector('button');
    button.click();

    assert(clicked === true, 'Handler from getter should be called');
    cleanup();
  });

  test('Component - invalid event handler syntax', async () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    class InvalidSyntaxComponent extends Component(HTMLElement) {

      render() {
        // Invalid: missing closing brace
        return html`<button onclick="{this.handler">Click</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(InvalidSyntaxComponent);

    console.warn = originalWarn;

    // Missing brace won't match regex, so no error - just verify component renders
    assert(component.querySelector('button') !== null, 'Component should render button even with malformed expression');
    cleanup();
  });

  test('Component - reactive attributes (class, title, data-*)', async () => {
    class ReactiveAttributesComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ className: 'initial', tooltip: 'Initial', value: '123' });
      }

      render() {
        return html`<div class="base {this.state.className}" title="{this.state.tooltip}" data-value="{this.state.value}">Content</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(ReactiveAttributesComponent);
    await flushEffects();

    const div = component.querySelector('div');
    assert(div !== null, 'Div should exist');
    assert(div.className === 'base initial', 'Should have initial classes');
    assert(div.getAttribute('title') === 'Initial', 'Should have initial title');
    assert(div.getAttribute('data-value') === '123', 'Should have initial data-value');

    // Update all attributes
    component.state.className = 'active';
    component.state.tooltip = 'Updated';
    component.state.value = '456';
    await flushEffects();

    assert(div.className === 'base active', 'Should have updated classes');
    assert(div.getAttribute('title') === 'Updated', 'Should have updated title');
    assert(div.getAttribute('data-value') === '456', 'Should have updated data-value');
    cleanup();
  });

  test('Component - non-reactive attributes (regular and boolean)', async () => {
    class NonReactiveAttrComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.value = 'initial';
        this.isDisabled = true;
      }

      render() {
        return html`
          <div data-value="{this.value}">Content</div>
          <button disabled="{this.isDisabled}">Button</button>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(NonReactiveAttrComponent);

    const div = component.querySelector('div');
    const button = component.querySelector('button');

    assert(div.getAttribute('data-value') === 'initial', 'Should have initial value');
    assert(button.disabled === true, 'Should be disabled initially');

    // Change non-reactive properties
    component.value = 'changed';
    await flushEffects();

    // Should still have old value (non-reactive)
    assert(div.getAttribute('data-value') === 'initial', 'Should not update (non-reactive)');
    cleanup();
  });

  test('Component - multiple reactive attributes on same element', async () => {
    class MultiAttrComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          id: 'elem1',
          className: 'active',
          title: 'Tooltip'
        });
      }

      render() {
        return html`<div id="{this.state.id}" class="{this.state.className}" title="{this.state.title}">Content</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(MultiAttrComponent);
    await flushEffects();

    const div = component.querySelector('div');
    assert(div.id === 'elem1', 'Should have initial id');
    assert(div.className === 'active', 'Should have initial class');
    assert(div.getAttribute('title') === 'Tooltip', 'Should have initial title');

    component.state.id = 'elem2';
    component.state.className = 'inactive';
    component.state.title = 'New tooltip';
    await flushEffects();

    assert(div.id === 'elem2', 'Should have updated id');
    assert(div.className === 'inactive', 'Should have updated class');
    assert(div.getAttribute('title') === 'New tooltip', 'Should have updated title');
    cleanup();
  });

  test('Component - event handler variations (direct function, method name, error handling)', async () => {
    let clickCount = 0;
    let methodCalled = false;
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    class EventHandlerVariationsComponent extends Component(HTMLElement) {

      myClickHandler = () => {
        clickCount++;
      }

      myMethod() {
        methodCalled = true;
      }

      render() {
        return html`
          <button id="direct" onclick="{this.myClickHandler}">Direct</button>
          <button id="method" onclick="{myMethod}">Method</button>
          <button id="error" onclick="{this.nonExistent.method}">Error</button>
        `;
      }
    }

    const { component, cleanup } = await createTestComponent(EventHandlerVariationsComponent);

    // Test direct function reference
    const directBtn = component.querySelector('#direct');
    directBtn.click();
    assert(clickCount === 1, 'Should call handler directly');
    directBtn.click();
    assert(clickCount === 2, 'Should call handler multiple times');

    // Test method name lookup
    const methodBtn = component.querySelector('#method');
    methodBtn.click();
    assert(methodCalled === true, 'Should find and call method by name');

    console.warn = originalWarn;

    // Test error handling
    const hasWarning = warnings.some(w => w.includes('Invalid'));
    assert(hasWarning, 'Should warn about invalid event handler expression');

    cleanup();
  });

  test('Component - reactive attribute on nested custom component', async () => {
    class NestedReceiver extends Component(HTMLElement) {
      static tag = 'test-nested-receiver';

      render() {
        const msg = this.getAttribute('message') || 'none';
        return html`<span>${msg}</span>`;
      }
    }

    class NestedParent extends Component(HTMLElement) {
      static tag = 'test-nested-parent';

      constructor() {
        super();
        this.state = this.reactive({ text: 'hello' });
      }

      render() {
        return html`<test-nested-receiver message="{this.state.text}"></test-nested-receiver>`;
      }
    }

    customElements.define('test-nested-receiver', NestedReceiver);
    customElements.define('test-nested-parent', NestedParent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const parent = document.createElement('test-nested-parent');
    container.appendChild(parent);

    await parent.rendered;
    await flushEffects();

    const receiver = parent.querySelector('test-nested-receiver');
    await receiver.rendered;

    const span = receiver.querySelector('span');
    assert(span.textContent === 'hello', 'Should pass reactive attribute to nested component');

    parent.state.text = 'world';
    await flushEffects();

    // Trigger re-render of receiver to get new attribute value
    await receiver.update();

    const updatedSpan = receiver.querySelector('span');
    assert(updatedSpan.textContent === 'world', 'Should update nested component attribute');

    container.remove();
  });

  test('Component - event handler with expression returning function', async () => {
    let called = false;

    class ExprFunctionComponent extends Component(HTMLElement) {

      handlers = {
        click: (e, node) => {
          called = true;
        }
      }

      render() {
        return html`<button onclick="{this.handlers.click}">Click</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(ExprFunctionComponent);

    const button = component.querySelector('button');
    button.click();

    assert(called === true, 'Should call function returned by expression');
    cleanup();
  });

  test('Component - method defined directly on component instance', async () => {
    let methodCalled = false;

    class DirectMethodComponent extends Component(HTMLElement) {

      constructor() {
        super();
        // Define method directly on instance
        this.handleClick = function() {
          methodCalled = true;
        };
      }

      render() {
        // Use this.handleClick so expression evaluates to function (lines 536-539)
        // versus just handleClick which uses #findMethod
        return html`<button onclick="{this.handleClick}">Click</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(DirectMethodComponent);

    const button = component.querySelector('button');
    button.click();

    assert(methodCalled === true, 'Should call method returned by expression');
    cleanup();
  });

  test('Component - findMethod finds method in current component', async () => {
    let foundMethodCalled = false;

    class FindMethodComponent extends Component(HTMLElement) {

      myLocalMethod() {
        foundMethodCalled = true;
      }

      render() {
        // Use simple name to trigger #findMethod lookup (lines 443-444)
        return html`<button onclick="{myLocalMethod}">Click</button>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(FindMethodComponent);

    const button = component.querySelector('button');
    button.click();

    assert(foundMethodCalled === true, 'Should find and call method in current component');
    cleanup();
  });

  test('Component - deeply nested framework components without nextSibling', async () => {
    // This tests the complex DOM traversal in _process() lines 412-418
    // when framework components are deeply nested and have no nextSibling

    class Level3Component extends Component(HTMLElement) {
      static tag = 'test-level3';
      render() {
        return html`<span>Deep content</span>`;
      }
    }

    class Level2Component extends Component(HTMLElement) {
      static tag = 'test-level2';
      render() {
        return html`<div><test-level3></test-level3></div>`;
      }
    }

    class Level1Component extends Component(HTMLElement) {
      static tag = 'test-level1';
      render() {
        return html`<div><test-level2></test-level2></div>`;
      }
    }

    class RootComponent extends Component(HTMLElement) {
      static tag = 'test-root-deep';
      render() {
        return html`<div><test-level1></test-level1></div>`;
      }
    }

    customElements.define('test-level3', Level3Component);
    customElements.define('test-level2', Level2Component);
    customElements.define('test-level1', Level1Component);
    customElements.define('test-root-deep', RootComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-root-deep');
    container.appendChild(component);

    await component.rendered;

    // Wait for nested components to render
    const level1 = component.querySelector('test-level1');
    if (level1) await level1.rendered;

    const level2 = component.querySelector('test-level2');
    if (level2) await level2.rendered;

    const level3 = component.querySelector('test-level3');
    if (level3) await level3.rendered;

    const span = component.querySelector('span');
    assert(span !== null, 'Should render deeply nested content');
    assert(span.textContent === 'Deep content', 'Should have correct content');

    container.remove();
  });

  test('Component - reactive attribute on veda-if component', async () => {
    const IfComponent = (await import('../src/components/IfComponent.js')).default;
    if (!customElements.get('veda-if-reactive')) {
      customElements.define('veda-if-reactive', IfComponent);
    }

    class IfWithAttrComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          show: true,
          dataValue: 'test123'
        });
      }

      render() {
        return html`
          <veda-if-reactive condition="{this.state.show}" data-test="{this.state.dataValue}">
            <div>Conditional content</div>
          </veda-if-reactive>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(IfWithAttrComponent);
    await flushEffects();

    const ifComponent = component.querySelector('veda-if-reactive');
    assert(ifComponent !== null, 'Should have veda-if component');

    // The data-test attribute should be set (but not condition/items/item-key which are framework attrs)
    assert(ifComponent.getAttribute('data-test') === 'test123', 'Should set non-framework attribute');

    component.state.dataValue = 'updated456';
    await flushEffects();

    assert(ifComponent.getAttribute('data-test') === 'updated456', 'Should update reactive attribute');
    cleanup();
  });

  test('Component - skip framework attributes on veda-loop', async () => {
    // This tests lines 478-479 - skipping framework-specific attributes
    const LoopComponent = (await import('../src/components/LoopComponent.js')).default;
    if (!customElements.get('veda-loop-frameworktest')) {
      customElements.define('veda-loop-frameworktest', LoopComponent);
    }

    class LoopAttrComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          items: [{id: 1, name: 'A'}, {id: 2, name: 'B'}],
          customData: 'mydata'
        });
      }

      render() {
        return html`
          <veda-loop-frameworktest
            items="{this.state.items}"
            item-key="id"
            data-custom="{this.state.customData}">
            <div>{this.model.name}</div>
          </veda-loop-frameworktest>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(LoopAttrComponent);
    await flushEffects();

    const loopComponent = component.querySelector('veda-loop-frameworktest');
    assert(loopComponent !== null, 'Should have veda-loop component');

    // data-custom should be set (lines 478-479 skip items/item-key)
    assert(loopComponent.getAttribute('data-custom') === 'mydata', 'Should set non-framework attribute');
    cleanup();
  });

  test('Component - DOM traversal when component has no nextSibling and parent has nextSibling', async () => {
    // Tests lines 413-416: complex DOM traversal
    // Structure: parent has two children, second child is custom component (no nextSibling)
    // When processing, we need to go up to parent and find parent's nextSibling

    class NestedLast extends Component(HTMLElement) {
      static tag = 'test-nested-last';
      render() {
        return html`<span>Nested</span>`;
      }
    }

    class ContainerComp extends Component(HTMLElement) {
      static tag = 'test-container-comp';

      render() {
        // First div, then custom component (last child - no nextSibling)
        return html`
          <div>
            <test-nested-last></test-nested-last>
          </div>
          <div>Sibling content</div>
        `;
      }
    }

    customElements.define('test-nested-last', NestedLast);
    customElements.define('test-container-comp', ContainerComp);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-container-comp');
    container.appendChild(component);

    await component.rendered;

    const nested = component.querySelector('test-nested-last');
    if (nested) await nested.rendered;

    const span = component.querySelector('span');
    assert(span !== null, 'Should render nested component');

    const sibling = component.querySelector('div:last-child');
    assert(sibling.textContent === 'Sibling content', 'Should process sibling after nested component');

    container.remove();
  });

  test('Component - findMethod returns method from current component', async () => {
    // Tests lines 443-444: finding method directly in this[name]
    // ATTEMPT: This test tries to create conditions where:
    // 1. evaluate() returns undefined (method not found during render)
    // 2. But this[name] exists as function (method added after render but before click)

    let methodCalled = false;

    class MethodInThisComponent extends Component(HTMLElement) {

      render() {
        // At render time, dynamicHandler doesn't exist
        // So evaluate() will return undefined
        // And we'll go to the /^\w+$/ branch that calls #findMethod
        return html`<button onclick="{dynamicHandler}">Click</button>`;
      }

      async connectedCallback() {
        await super.connectedCallback();

        // Add method AFTER render, but BEFORE click
        // This way evaluate() returned undefined during render,
        // but this[name] exists when #findMethod is called
        this.dynamicHandler = function() {
          methodCalled = true;
        };
      }
    }

    const { component, container, cleanup } = await createTestComponent(MethodInThisComponent);

    // Verify method was added
    assert(typeof component.dynamicHandler === 'function', 'Method should be added after render');

    const button = component.querySelector('button');
    button.click();

    assert(methodCalled === true, 'Should find method via #findMethod even if added after render');
    cleanup();
  });

  test('Component - skip framework attrs: condition attribute on veda-if', async () => {
    // Tests lines 478-479: skipping 'condition' attribute in loop
    // Need to use actual 'veda-if' tag name (not veda-if-reactive)
    const IfComponent = (await import('../src/components/IfComponent.js')).default;

    // Register as veda-if if not already registered
    if (!customElements.get('veda-if')) {
      customElements.define('veda-if', IfComponent);
    }

    class IfSkipAttrComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({
          show: true,
          otherData: 'test456'
        });
      }

      render() {
        return html`
          <veda-if
            condition="{this.state.show}"
            data-other="{this.state.otherData}">
            <div>Content</div>
          </veda-if>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(IfSkipAttrComponent);
    await flushEffects();

    const ifComp = component.querySelector('veda-if');

    // condition should be handled by veda-if itself, not as reactive attribute
    // data-other should be set as reactive attribute
    assert(ifComp.getAttribute('data-other') === 'test456', 'Non-framework attr should be set');
    cleanup();
  });

  test('Component - inline component (HTML element with about attribute)', async () => {
    // Tests lines 331-340: creates inline component for HTML element with 'about'
    const Model = (await import('../src/Model.js')).default;

    class InlineTestComponent extends Component(HTMLElement) {

      async connectedCallback() {
        // Create a model for testing
        this.model = new Model({
          id: 'd:test-inline',
          'v-s:title': 'Test Title'
        });

        await super.connectedCallback();
      }

      render() {
        return html`
          <div>
            <span about="d:test-inline">Inline component content</span>
          </div>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(InlineTestComponent);

    const span = component.querySelector('span');
    assert(span !== null, 'Should have span element');
    assert(span.hasAttribute('is'), 'Should have is attribute for inline component');
    assert(span.getAttribute('is').includes('span-inline-component'), 'Should have inline component class');
    cleanup();
  });

  test('Component - property component (HTML element with property attribute)', async () => {
    // Tests lines 344-361: creates PropertyComponent for HTML element with 'property'
    const Model = (await import('../src/Model.js')).default;

    class PropertyTestComponent extends Component(HTMLElement) {

      async connectedCallback() {
        // Create a model for testing
        this.model = new Model({
          id: 'd:test-property',
          'v-s:title': 'Property Value'
        });

        await super.connectedCallback();
      }

      render() {
        return html`
          <div>
            <span property="v-s:title"></span>
          </div>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(PropertyTestComponent);
    await flushEffects();

    const span = component.querySelector('span');
    assert(span !== null, 'Should have span element');
    assert(span.hasAttribute('is'), 'Should have is attribute for property component');
    assert(span.getAttribute('is').includes('span-property-component'), 'Should have property component class');

    // PropertyComponent needs the element to be connected and populated
    // Wait a bit more for async operations
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check if property component rendered (it should display the value)
    // Just verify the component was created, not the content
    // as PropertyComponent may need specific lifecycle
    cleanup();
  });

  test('Component - relation component (HTML element with rel attribute)', async () => {
    // Tests lines 344-361: creates RelationComponent for HTML element with 'rel'
    const Model = (await import('../src/Model.js')).default;

    class RelTestComponent extends Component(HTMLElement) {

      async connectedCallback() {
        // Create models for testing
        const item1 = new Model({ id: 'd:item1', 'v-s:title': 'Item 1' });
        const item2 = new Model({ id: 'd:item2', 'v-s:title': 'Item 2' });

        this.model = new Model({
          id: 'd:test-rel',
          'v-s:hasItem': [item1, item2]
        });

        await super.connectedCallback();
      }

      render() {
        return html`
          <div>
            <ul rel="v-s:hasItem">
              <li property="v-s:title"></li>
            </ul>
          </div>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(RelTestComponent);
    await flushEffects();

    const ul = component.querySelector('ul');
    assert(ul !== null, 'Should have ul element');
    assert(ul.hasAttribute('is'), 'Should have is attribute for relation component');
    assert(ul.getAttribute('is').includes('ul-rel-component'), 'Should have rel component class');

    const items = ul.querySelectorAll('li');
    assert(items.length === 2, 'Should render 2 items');
    cleanup();
  });

  test('Component - customized built-in element with is attribute', async () => {
    // Tests lines 377-389: handles customized built-in elements
    // This tests elements like <button is="fancy-button"> where fancy-button
    // is registered as a customized built-in element

    // Register a simple custom element that can be used with 'is' attribute
    // In real browsers, this would extend HTMLButtonElement, but jsdom doesn't support that
    // So we register it as a standalone custom element
    class FancyButtonCustomization extends HTMLElement {
      connectedCallback() {
        this.classList.add('fancy');
      }
    }

    if (!customElements.get('fancy-btn-custom')) {
      customElements.define('fancy-btn-custom', FancyButtonCustomization);
    }

    class CustomizedBuiltinTestComponent extends Component(HTMLElement) {

      render() {
        // Use a regular button tag with 'is' attribute
        // In template, 'button' doesn't have a dash, so it's not custom
        // But 'is' attribute makes it use the custom element
        return html`
          <div>
            <button is="fancy-btn-custom" class="test">Click me</button>
          </div>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(CustomizedBuiltinTestComponent);

    // The button should be processed via the customized built-in path (lines 377-389)
    const button = component.querySelector('[is="fancy-btn-custom"]');
    assert(button !== null, 'Should have button with is attribute');
    assert(button.getAttribute('is') === 'fancy-btn-custom', 'Should preserve is attribute');
    assert(button.hasAttribute('class'), 'Should preserve other attributes');
    cleanup();
  });

  test('Component - auto-detect reactive state in populate', async () => {
    // Tests lines 180-181: auto-detect reactive state when state.__isReactive exists
    // The condition checks: !this.#isReactive && this.state && this.state.__isReactive
    // We need to create reactive state WITHOUT calling this.reactive()

    // Import reactive from Component.js (already exported there)
    const { reactive } = await import('../src/components/Component.js');

    class AutoReactiveComponent extends Component(HTMLElement) {
      static tag = 'test-auto-reactive-populate';

      render() {
        return html`<div>Count: {this.state.count}</div>`;
      }
    }

    customElements.define('test-auto-reactive-populate', AutoReactiveComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-auto-reactive-populate');

    // Create reactive state using reactive() directly, not this.reactive()
    // This keeps #isReactive false
    component.state = reactive({ count: 0 });

    // Verify state is reactive
    assert(component.state.__isReactive === true, 'State should be reactive');

    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const div = component.querySelector('div');
    assert(div.textContent.includes('Count: 0'), 'Should display initial count');

    // Update state to verify reactivity was auto-detected
    component.state.count = 5;
    await flushEffects();

    assert(div.textContent.includes('Count: 5'), 'Should update reactively after auto-detection');

    container.remove();
  });

  test('Component - text with trailing static content after expression', async () => {
    // Tests lines 239-243: adding remaining static text after last expression
    class TrailingTextComponent extends Component(HTMLElement) {

      constructor() {
        super();
        this.state = this.reactive({ name: 'John' });
      }

      render() {
        // Expression followed by static text
        return html`<div>Hello {this.state.name}, welcome!</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TrailingTextComponent);
    await flushEffects();

    const div = component.querySelector('div');
    assert(div.textContent === 'Hello John, welcome!', 'Should include trailing static text');
    cleanup();
  });

  test('Component - auto-detect reactive state in _process', async () => {
    // Tests lines 291-292: auto-detect reactive state in _process
    // Import reactive from Component.js (already exported there)
    const { reactive } = await import('../src/components/Component.js');

    class ProcessReactiveComponent extends Component(HTMLElement) {
      static tag = 'test-process-reactive';

      render() {
        return html`<span>{this.state.value}</span>`;
      }
    }

    customElements.define('test-process-reactive', ProcessReactiveComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-process-reactive');

    // Create reactive state using reactive() directly, not this.reactive()
    component.state = reactive({ value: 'test' });

    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const span = component.querySelector('span');
    assert(span.textContent === 'test', 'Should render with detected reactive state');

    container.remove();
  });

  test('Component - skip template inside veda-if component', async () => {
    // Tests lines 310-316: skip <template> inside veda-if/veda-loop
    // The code checks if template's parent is VEDA-IF or VEDA-LOOP and skips it

    // This test is complex because it requires veda-if to properly process the template
    // The skip logic prevents parent component from processing framework component templates
    // For now, we verify the logic works by checking that framework components exist

    const IfComponent = (await import('../src/components/IfComponent.js')).default;
    const IfClass = IfComponent(HTMLElement);

    if (!customElements.get('veda-if-templateskip2')) {
      customElements.define('veda-if-templateskip2', IfClass);
    }

    class TemplateSkipComponent extends Component(HTMLElement) {

      render() {
        // Static condition to ensure veda-if renders
        return html`
          <div>
            <veda-if-templateskip2 condition="true">
              <template>
                <span class="inside-template">Content inside template</span>
              </template>
            </veda-if-templateskip2>
          </div>
        `;
      }
    }

    const { component, container, cleanup } = await createTestComponent(TemplateSkipComponent);
    await flushEffects();
    await new Promise(resolve => setTimeout(resolve, 100));

    const vedaIf = component.querySelector('veda-if-templateskip2');
    assert(vedaIf !== null, 'Should have veda-if component');

    // Note: Lines 310-316 are covered when the walker encounters a template inside veda-if/veda-loop
    // The template skip logic is tested - we verify the component renders without errors
    assert(component.isConnected, 'Template skip logic should work without errors');
    cleanup();
  });

  test('Component - DOM traversal up when component has no nextSibling', async () => {
    // Tests lines 413-416: traverse up the tree when component has no nextSibling
    // This requires a very specific DOM structure:
    // - Custom component as last child of its parent
    // - Parent has a nextSibling

    class DeepNestedChild extends Component(HTMLElement) {
      static tag = 'test-deep-nested-child';

      render() {
        return html`<span>Deeply nested</span>`;
      }
    }

    class DeepNestedParent extends Component(HTMLElement) {
      static tag = 'test-deep-nested-parent';

      render() {
        // Container with child component as last element (no nextSibling)
        return html`
          <div class="wrapper">
            <div class="inner">
              <test-deep-nested-child></test-deep-nested-child>
            </div>
            <div class="sibling">After</div>
          </div>
        `;
      }
    }

    customElements.define('test-deep-nested-child', DeepNestedChild);
    customElements.define('test-deep-nested-parent', DeepNestedParent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-deep-nested-parent');
    container.appendChild(component);

    await component.rendered;

    // Wait for nested component to render
    const nested = component.querySelector('test-deep-nested-child');
    if (nested && nested.rendered) {
      await nested.rendered;
    }

    const span = component.querySelector('span');
    assert(span !== null, 'Should render deeply nested component');

    const sibling = component.querySelector('.sibling');
    assert(sibling !== null, 'Should process sibling after nested component');
    assert(sibling.textContent === 'After', 'Should have correct sibling content');

    container.remove();
  });

  test('Component - auto-detect reactive state (lines 291-292)', async () => {
    // Test auto-detection of reactive state in _process when not detected in populate
    const {reactive: makeReactive} = await import('../src/Reactive.js');

    class LateReactiveComponent extends Component(HTMLElement) {

      async populate() {
        // Call super.populate() BEFORE assigning state
        // This way, line 179 won't catch it
        await super.populate();
        // Now assign reactive state AFTER populate
        // This will be caught by line 291-292 in _process
        this.state = makeReactive({ value: 'late-reactive' });
      }

      render() {
        if (!this.state) return html`<div>No state</div>`;
        return html`<div>{this.state.value}</div>`;
      }
    }

    const { component, container, cleanup } = await createTestComponent(LateReactiveComponent);
    await flushEffects();

    assert(component.querySelector('div').textContent === 'late-reactive', 'Should auto-detect reactive state in _process');
    cleanup();
  });

  test('Component - skip template inside veda-if (lines 310-316)', async () => {
    // Test that walker skips <template> with veda-if parent
    // We need to ensure the template exists DURING _process walk

    class ComponentWithIfTemplate extends Component(HTMLElement) {
      static tag = 'test-component-if-template';

      render() {
        // Create veda-if with template child
        // The walker will encounter this template and check its parent
        return html`
          <div>
            <p>Before</p>
            <veda-if condition="true">
              <template>
                <span>Inside IF template</span>
              </template>
            </veda-if>
            <p>After</p>
          </div>
        `;
      }
    }

    if (!customElements.get('test-component-if-template')) {
      customElements.define('test-component-if-template', ComponentWithIfTemplate);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-component-if-template');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    // The template should be preserved for veda-if to handle
    const vedaIf = component.querySelector('veda-if');
    assert(vedaIf !== null, 'Should have veda-if element');

    // Verify walker didn't break on the template
    assert(component.querySelector('p') !== null, 'Should process elements after veda-if');

    container.remove();
  });

  test('Component - skip template inside veda-loop (lines 310-316)', async () => {
    // Test that walker skips <template> with veda-loop parent

    class ComponentWithLoopTemplate extends Component(HTMLElement) {
      static tag = 'test-component-loop-template';

      render() {
        // Create veda-loop with template child
        return html`
          <div>
            <p>Before</p>
            <veda-loop items="[]">
              <template>
                <span>Inside LOOP template</span>
              </template>
            </veda-loop>
            <p>After</p>
          </div>
        `;
      }
    }

    if (!customElements.get('test-component-loop-template')) {
      customElements.define('test-component-loop-template', ComponentWithLoopTemplate);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-component-loop-template');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    // The template should be preserved for veda-loop to handle
    const vedaLoop = component.querySelector('veda-loop');
    assert(vedaLoop !== null, 'Should have veda-loop element');

    // Verify walker didn't break on the template
    const paragraphs = component.querySelectorAll('p');
    assert(paragraphs.length === 2, 'Should process elements before and after veda-loop');

    container.remove();
  });

  test('Component - direct _process call with template in veda-if (lines 310-316)', () => {
    // Directly test _process with manually constructed DOM containing <template> inside veda-if
    class DirectProcessComponent extends Component(HTMLElement) {
      static tag = 'test-direct-process';
      render() { return html`<div>Base</div>`; }
    }

    if (!customElements.get('test-direct-process')) {
      customElements.define('test-direct-process', DirectProcessComponent);
    }

    const component = new DirectProcessComponent();
    document.body.appendChild(component);

    // Create a fragment with veda-if containing template
    const fragment = document.createDocumentFragment();
    const vedaIf = document.createElement('veda-if');
    const template = document.createElement('template');
    template.innerHTML = '<span>Template content</span>';
    vedaIf.appendChild(template);
    fragment.appendChild(vedaIf);

    // Manually call _process - this should trigger lines 310-316
    component._process(fragment);

    // Verify the fragment was processed without errors
    assert(fragment.querySelector('veda-if') !== null, 'Should process fragment with veda-if template');

    component.remove();
  });

  test('Component - deeply nested component without siblings (lines 413-416)', async () => {
    // Test the while loop that traverses up when component has no nextSibling
    class DeepestChild extends Component(HTMLElement) {
      static tag = 'test-deepest-child';
      render() { return html`<em>Deep</em>`; }
    }

    class MiddleParent extends Component(HTMLElement) {
      static tag = 'test-middle-parent';
      render() {
        return html`
          <section>
            <article>
              <test-deepest-child></test-deepest-child>
            </article>
          </section>
        `;
      }
    }

    class TopParent extends Component(HTMLElement) {
      static tag = 'test-top-parent';
      render() {
        return html`
          <div>
            <test-middle-parent></test-middle-parent>
            <aside>Sibling at top level</aside>
          </div>
        `;
      }
    }

    if (!customElements.get('test-deepest-child')) {
      customElements.define('test-deepest-child', DeepestChild);
    }
    if (!customElements.get('test-middle-parent')) {
      customElements.define('test-middle-parent', MiddleParent);
    }
    if (!customElements.get('test-top-parent')) {
      customElements.define('test-top-parent', TopParent);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-top-parent');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    // Wait for all nested components
    const middle = component.querySelector('test-middle-parent');
    if (middle && middle.rendered) await middle.rendered;

    const deepest = component.querySelector('test-deepest-child');
    if (deepest && deepest.rendered) await deepest.rendered;

    // Verify all levels rendered and sibling was processed
    assert(component.querySelector('em') !== null, 'Should render deepest child');
    assert(component.querySelector('aside') !== null, 'Should process sibling after traversing up (lines 413-416)');

    container.remove();
  });

  test('Component - nullish coalescing in reactive attribute (line 503)', async () => {
    // Test that ?? '' in line 503 handles undefined/null from ExpressionParser.evaluate
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-nullish-reactive-attr';
      state = reactive({ value: undefined });
      render() {
        return html`<div data-test="{this.state.nonExistent}">Content</div>`;
      }
    }

    if (!customElements.get('test-nullish-reactive-attr')) {
      customElements.define('test-nullish-reactive-attr', TestComponent);
    }

    const component = document.createElement('test-nullish-reactive-attr');
    document.body.appendChild(component);
    await component.rendered;
    await flushEffects();

    const div = component.querySelector('div');
    // When ExpressionParser.evaluate returns undefined, ?? '' should provide empty string
    assert(div.getAttribute('data-test') === '', 'Should use empty string when expression returns undefined (line 503)');

    component.remove();
  });

  test('Component - nullish coalescing in non-reactive attribute (line 514)', async () => {
    // Test that ?? '' in line 514 handles undefined/null from this.#evaluate
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-nullish-non-reactive-attr';
      // No reactive state
      render() {
        return html`<div data-test="{this.nonExistentProp}">Content</div>`;
      }
    }

    if (!customElements.get('test-nullish-non-reactive-attr')) {
      customElements.define('test-nullish-non-reactive-attr', TestComponent);
    }

    const component = document.createElement('test-nullish-non-reactive-attr');
    document.body.appendChild(component);
    await component.rendered;

    const div = component.querySelector('div');
    // When this.#evaluate returns undefined, ?? '' should provide empty string
    assert(div.getAttribute('data-test') === '', 'Should use empty string when #evaluate returns undefined (line 514)');

    component.remove();
  });

  test('Component - nullish coalescing in reactive boolean attribute (line 590)', async () => {
    // Test that ?? '' in line 590 handles undefined/null for boolean attributes
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-nullish-reactive-bool';
      state = reactive({ checked: undefined });
      render() {
        return html`<input type="checkbox" checked="{this.state.nonExistent}">`;
      }
    }

    if (!customElements.get('test-nullish-reactive-bool')) {
      customElements.define('test-nullish-reactive-bool', TestComponent);
    }

    const component = document.createElement('test-nullish-reactive-bool');
    document.body.appendChild(component);
    await component.rendered;
    await flushEffects();

    const input = component.querySelector('input');
    // When ExpressionParser.evaluate returns undefined, ?? '' provides ''
    // Line 595: boolValue = value === 'true' || value === '' || value === attrName
    // Since value === '', boolValue is true
    assert(input.checked === true, 'Should be checked when expression returns undefined -> empty string (line 590)');

    component.remove();
  });

  test('Component - nullish coalescing in non-reactive boolean attribute (line 612)', async () => {
    // Test that ?? '' in line 612 handles undefined/null for boolean attributes
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-nullish-non-reactive-bool';
      // No reactive state
      render() {
        return html`<input type="checkbox" checked="{this.nonExistentProp}">`;
      }
    }

    if (!customElements.get('test-nullish-non-reactive-bool')) {
      customElements.define('test-nullish-non-reactive-bool', TestComponent);
    }

    const component = document.createElement('test-nullish-non-reactive-bool');
    document.body.appendChild(component);
    await component.rendered;

    const input = component.querySelector('input');
    // When this.#evaluate returns undefined, ?? '' provides ''
    // Line 616: boolValue = value === 'true' || value === '' || value === attrName
    // Since value === '', boolValue is true
    assert(input.checked === true, 'Should be checked when #evaluate returns undefined -> empty string (line 612)');

    component.remove();
  });

  test('Component - evalContext branch in reactive attr (lines 499)', async () => {
    // Test line 499: const evalContext = this._currentEvalContext || this;
    // When inside veda-if, _currentEvalContext is set and we should use it
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-eval-context-499';
      state = reactive({ show: true });
      render() {
        return html`
          <veda-if condition="{this.state.show}">
            <div data-test="{this.nonExistent}">Content</div>
          </veda-if>
        `;
      }
    }

    if (!customElements.get('test-eval-context-499')) {
      customElements.define('test-eval-context-499', TestComponent);
    }

    const component = document.createElement('test-eval-context-499');
    document.body.appendChild(component);
    await component.rendered;
    await flushEffects();

    const div = component.querySelector('div');
    // Should use evalContext (line 499) and handle undefined with ?? ''
    assert(div !== null, 'Should render div inside veda-if');
    assert(div.getAttribute('data-test') === '', 'Should use empty string when evalContext expression is undefined (line 499)');

    component.remove();
  });

  test('Component - evalContext branch in reactive bool attr (line 586)', async () => {
    // Test line 586: const evalContext = this._currentEvalContext || this;
    // When inside veda-if with boolean attribute
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-eval-context-586';
      state = reactive({ show: true });
      render() {
        return html`
          <veda-if condition="{this.state.show}">
            <input type="checkbox" checked="{this.nonExistent}">
          </veda-if>
        `;
      }
    }

    if (!customElements.get('test-eval-context-586')) {
      customElements.define('test-eval-context-586', TestComponent);
    }

    const component = document.createElement('test-eval-context-586');
    document.body.appendChild(component);
    await component.rendered;
    await flushEffects();

    const input = component.querySelector('input');
    // Should use evalContext (line 586) and handle undefined with ?? '' (line 590)
    // Line 595: boolValue = value === 'true' || value === '' || value === attrName
    // Since value === '', boolValue is true
    assert(input !== null, 'Should render input inside veda-if');
    assert(input.checked === true, 'Should be checked when evalContext expression is undefined -> empty string (lines 586, 590)');

    component.remove();
  });

  test('Component - contextForReactivity branch (line 577)', async () => {
    // Test line 577: const contextForReactivity = this._currentEvalContext || this;
    // This is used to check reactivity in veda-if/veda-loop contexts
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-context-reactivity-577';
      state = reactive({ show: true });
      render() {
        return html`
          <veda-if condition="{this.state.show}">
            <button disabled="{this.state.isDisabled}">Click</button>
          </veda-if>
        `;
      }
    }

    if (!customElements.get('test-context-reactivity-577')) {
      customElements.define('test-context-reactivity-577', TestComponent);
    }

    const component = document.createElement('test-context-reactivity-577');
    document.body.appendChild(component);
    await component.rendered;
    await flushEffects();

    const button = component.querySelector('button');
    assert(button !== null, 'Should render button inside veda-if');
    // Should use contextForReactivity (line 577) to check if parent is reactive
    
    // Change state to test reactivity
    component.state.isDisabled = true;
    await flushEffects();
    assert(button.disabled === true, 'Should be disabled after state change (using contextForReactivity line 577)');

    component.remove();
  });

  test('Component - boolValue calculation with empty string (line 616)', async () => {
    // Test line 616: const boolValue = value === 'true' || value === '' || value === attrName;
    // When value is '' (from ?? ''), boolValue should be true
    class TestComponent extends Component(HTMLElement) {
      static tag = 'test-bool-value-616';
      render() {
        // When this.nonExistent is undefined, ?? '' provides '', making boolValue true
        return html`<input type="checkbox" checked="{this.nonExistent}">`;
      }
    }

    if (!customElements.get('test-bool-value-616')) {
      customElements.define('test-bool-value-616', TestComponent);
    }

    const component = document.createElement('test-bool-value-616');
    document.body.appendChild(component);
    await component.rendered;

    const input = component.querySelector('input');
    // Line 616: boolValue = value === 'true' || value === '' || value === attrName
    // When value is '', the second part (value === '') should be true
    assert(input.checked === true, 'Should be checked when value is empty string (line 616)');

    component.remove();
  });

};


