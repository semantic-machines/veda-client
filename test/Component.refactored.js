import './setup-dom.js';
import Component, { html, raw, safe, reactive, effect } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';
import Model from '../src/Model.js';

export default ({ test, assert }) => {

  // ==================== REUSABLE TEST COMPONENTS ====================
  
  // Basic component for simple tests
  class BasicTestComponent extends Component(HTMLElement) {
    static tag = 'test-basic';
    render() { return html`<div>Basic</div>`; }
  }
  
  // Component with reactive state
  class ReactiveTestComponent extends Component(HTMLElement) {
    static tag = 'test-reactive';
    constructor() {
      super();
      this.state = this.reactive({ value: 'initial' });
    }
    render() { return html`<div>{this.state.value}</div>`; }
  }
  
  // Component with lifecycle hooks
  class LifecycleTestComponent extends Component(HTMLElement) {
    static tag = 'test-lifecycle';
    constructor() {
      super();
      this.calls = [];
    }
    pre() { this.calls.push('pre'); }
    added() { this.calls.push('added'); }
    render() { this.calls.push('render'); return html`<div>Lifecycle</div>`; }
    post() { this.calls.push('post'); }
    removed() { this.calls.push('removed'); }
  }
  
  // Register reusable components
  if (!customElements.get('test-basic')) customElements.define('test-basic', BasicTestComponent);
  if (!customElements.get('test-reactive')) customElements.define('test-reactive', ReactiveTestComponent);
  if (!customElements.get('test-lifecycle')) customElements.define('test-lifecycle', LifecycleTestComponent);

  // ==================== HELPER FUNCTIONS ====================
  
  async function createAndRenderComponent(tag, setup = null) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const component = document.createElement(tag);
    if (setup) setup(component);
    container.appendChild(component);
    await component.rendered;
    await flushEffects();
    return { component, container };
  }

  // ==================== HTML TEMPLATE TESTS ====================

  test('html() - escapes values, preserves safe markup, handles arrays', () => {
    // Combine 3 tests into 1
    const xss = '<script>alert("xss")</script>';
    const escaped = html`<div>${xss}</div>`;
    assert(escaped.includes('&lt;script&gt;') && !escaped.includes('<script>'), 'Should escape HTML');
    
    const inner = html`<span>Safe</span>`;
    const outer = html`<div>${inner}</div>`;
    assert(outer.includes('<span>Safe</span>'), 'Should preserve safe markup');
    
    const items = ['<b>one</b>', '<b>two</b>'];
    const withArray = html`<div>${items}</div>`;
    assert(withArray.includes('&lt;b&gt;'), 'Should escape array items');
  });

  test('raw() - does not escape values', () => {
    const markup = '<span>Raw HTML</span>';
    const result = raw`<div>${markup}</div>`;
    assert(result.includes('<span>Raw HTML</span>'), 'Should preserve raw markup');
  });

  test('safe() - escapes dangerous chars and removes expressions', () => {
    const dangerous = '<script>alert("xss")</script>';
    assert(safe(dangerous) === '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;', 'Should escape all dangerous chars');
    
    const text = 'Hello {this.name} world';
    assert(safe(text) === 'Hello  world', 'Should remove {expressions}');
    
    const arr = ['<div>', '{expr}'];
    const result = safe(arr);
    assert(result[0] === '&lt;div&gt;' && result[1] === '', 'Should handle arrays recursively');
  });


  // ==================== COMPONENT BASICS ====================

  test('Component - instantiation, tag, lifecycle hooks', async () => {
    // Combines: basic instantiation, toString, lifecycle hooks order
    const { component, container } = await createAndRenderComponent('test-lifecycle');
    
    assert(component instanceof Component(HTMLElement), 'Should be instance of Component');
    assert(BasicTestComponent.toString() === 'test-basic', 'toString returns tag');
    assert.deepStrictEqual(component.calls, ['pre', 'render', 'added', 'post'], 'Hooks in correct order');
    
    container.remove();
    await flushEffects();
    assert(component.calls.includes('removed'), 'removed() called on disconnect');
  });

  test('Component - reactive state changes trigger re-render', async () => {
    const { component, container } = await createAndRenderComponent('test-reactive');
    
    assert(component.textContent === 'initial', 'Initial render');
    component.state.value = 'updated';
    await flushEffects();
    assert(component.textContent === 'updated', 'Re-rendered on state change');
    
    container.remove();
  });

  // ==================== REACTIVE ATTRIBUTES ====================

  test('Component - reactive attributes (class, title, data-*, boolean)', async () => {
    // Combines 6+ attribute tests into 1
    class AttrTestComponent extends Component(HTMLElement) {
      static tag = 'test-attrs';
      constructor() {
        super();
        this.state = this.reactive({ cls: 'active', title: 'Hello', value: 'test', checked: true });
      }
      render() {
        return html`
          <button class="{this.state.cls}" title="{this.state.title}" data-value="{this.state.value}" checked="{this.state.checked}">
            Button
          </button>
        `;
      }
    }
    if (!customElements.get('test-attrs')) customElements.define('test-attrs', AttrTestComponent);
    
    const { component, container } = await createAndRenderComponent('test-attrs');
    const btn = component.querySelector('button');
    
    // Initial state
    assert(btn.className === 'active', 'Initial class');
    assert(btn.title === 'Hello', 'Initial title');
    assert(btn.dataset.value === 'test', 'Initial data attribute');
    assert(btn.checked === true, 'Initial boolean attribute');
    
    // Update state
    component.state.cls = 'inactive';
    component.state.title = 'World';
    component.state.value = 'updated';
    component.state.checked = false;
    await flushEffects();
    
    assert(btn.className === 'inactive', 'Updated class');
    assert(btn.title === 'World', 'Updated title');
    assert(btn.dataset.value === 'updated', 'Updated data attribute');
    assert(btn.checked === false, 'Updated boolean attribute');
    
    container.remove();
  });

  // ==================== EVENT HANDLERS ====================

  test('Component - event handlers (method, expression, function)', async () => {
    // Combines 8+ event handler tests
    let methodCalled = false;
    let expressionCalled = false;
    let directCalled = false;
    let eventReceived = null;
    let nodeReceived = null;
    
    class EventTestComponent extends Component(HTMLElement) {
      static tag = 'test-events';
      handleMethod(e, node) {
        methodCalled = true;
        eventReceived = e;
        nodeReceived = node;
      }
      getHandler() {
        return () => { expressionCalled = true; };
      }
      render() {
        return html`
          <button data-method onclick="{this.handleMethod}">Method</button>
          <button data-expr onclick="{this.getHandler()}">Expression</button>
          <button data-direct onclick="${() => { directCalled = true; }}">Direct</button>
        `;
      }
    }
    if (!customElements.get('test-events')) customElements.define('test-events', EventTestComponent);
    
    const { component, container } = await createAndRenderComponent('test-events');
    
    // Test method binding
    const methodBtn = component.querySelector('[data-method]');
    methodBtn.click();
    assert(methodCalled, 'Method handler called');
    assert(eventReceived instanceof Event, 'Event passed to handler');
    assert(nodeReceived === methodBtn, 'Node passed to handler');
    
    // Test expression
    const exprBtn = component.querySelector('[data-expr]');
    exprBtn.click();
    assert(expressionCalled, 'Expression handler called');
    
    // Test direct function
    const directBtn = component.querySelector('[data-direct]');
    directBtn.click();
    assert(directCalled, 'Direct function handler called');
    
    container.remove();
  });

  // ==================== MODEL INTEGRATION ====================

  test('Component - model property, about attribute, populate', async () => {
    // Combines model integration tests
    class ModelTestComponent extends Component(HTMLElement) {
      static tag = 'test-model';
      render() {
        return html`<div>{this.model?.name || 'No model'}</div>`;
      }
    }
    if (!customElements.get('test-model')) customElements.define('test-model', ModelTestComponent);
    
    const model = new Model({ id: 'test-123', name: 'Test Model' });
    const { component, container } = await createAndRenderComponent('test-model', (c) => {
      c.model = model;
    });
    
    assert(component.textContent === 'Test Model', 'Renders model data');
    assert(component.getAttribute('about') === 'test-123', 'Sets about attribute from model.id');
    
    // Test populate via attribute
    const component2 = document.createElement('test-model');
    component2.setAttribute('about', 'test-456');
    document.body.appendChild(component2);
    await component2.rendered;
    
    assert(component2.model?.id === 'test-456', 'populate() creates model from about attribute');
    
    component2.remove();
    container.remove();
  });

  // ==================== EXPRESSIONS ====================

  test('Component - expressions (undefined/null, falsy, optional chaining, static)', async () => {
    // Combines expression handling tests
    class ExprTestComponent extends Component(HTMLElement) {
      static tag = 'test-expr';
      constructor() {
        super();
        this.state = this.reactive({ 
          undef: undefined, 
          nul: null, 
          zero: 0, 
          empty: '', 
          obj: { nested: { value: 'deep' } },
          missing: null
        });
      }
      render() {
        return html`
          <div data-undef>{this.state.undef}</div>
          <div data-null>{this.state.nul}</div>
          <div data-zero>{this.state.zero}</div>
          <div data-empty>{this.state.empty}</div>
          <div data-chain>{this.state.obj?.nested?.value}</div>
          <div data-chain-missing>{this.state.missing?.nested?.value}</div>
          <div data-static>$\{this.state.zero}</div>
        `;
      }
    }
    if (!customElements.get('test-expr')) customElements.define('test-expr', ExprTestComponent);
    
    const { component, container } = await createAndRenderComponent('test-expr');
    
    assert(component.querySelector('[data-undef]').textContent === '', 'undefined renders as empty');
    assert(component.querySelector('[data-null]').textContent === '', 'null renders as empty');
    assert(component.querySelector('[data-zero]').textContent === '0', 'zero renders as "0"');
    assert(component.querySelector('[data-empty]').textContent === '', 'empty string renders');
    assert(component.querySelector('[data-chain]').textContent === 'deep', 'optional chaining works');
    assert(component.querySelector('[data-chain-missing]').textContent === '', 'optional chaining on undefined');
    assert(component.querySelector('[data-static]').textContent === '${this.state.zero}', 'static expression not evaluated');
    
    container.remove();
  });

  // ==================== HELPER METHODS ====================

  test('Component - effect() and watch() helpers', async () => {
    // Combines effect and watch tests
    let effectRuns = 0;
    let watchRuns = 0;
    let watchImmediateRuns = 0;
    let cleanupCalled = false;
    
    class HelperTestComponent extends Component(HTMLElement) {
      static tag = 'test-helpers';
      constructor() {
        super();
        this.state = this.reactive({ count: 0 });
        
        this.effect(() => {
          effectRuns++;
          return this.state.count;
        });
        
        this.watch(() => this.state.count, () => {
          watchRuns++;
        });
        
        this.watch(() => this.state.count, () => {
          watchImmediateRuns++;
        }, { immediate: true });
        
        this.watch(() => this.state.count, () => {
          return () => { cleanupCalled = true; };
        });
      }
      render() { return html`<div>{this.state.count}</div>`; }
    }
    if (!customElements.get('test-helpers')) customElements.define('test-helpers', HelperTestComponent);
    
    const { component, container } = await createAndRenderComponent('test-helpers');
    
    const initialEffectRuns = effectRuns;
    const initialWatchImmediateRuns = watchImmediateRuns;
    
    assert(initialWatchImmediateRuns > 0, 'watch with immediate runs on init');
    
    component.state.count = 1;
    await flushEffects();
    
    assert(effectRuns > initialEffectRuns, 'effect() runs on state change');
    assert(watchRuns > 0, 'watch() runs on state change');
    assert(cleanupCalled, 'watch cleanup called on next run');
    
    container.remove();
  });

  // ==================== RENDERING MODES ====================

  test('Component - render modes (async, undefined, template property, innerHTML)', async () => {
    // Combines rendering mode tests
    
    // Async render
    class AsyncComponent extends Component(HTMLElement) {
      static tag = 'test-async';
      async render() {
        await new Promise(r => setTimeout(r, 10));
        return html`<div>Async</div>`;
      }
    }
    if (!customElements.get('test-async')) customElements.define('test-async', AsyncComponent);
    
    const { component: async1, container: container1 } = await createAndRenderComponent('test-async');
    assert(async1.textContent === 'Async', 'Async render works');
    container1.remove();
    
    // render returns undefined - use template property
    class TemplateComponent extends Component(HTMLElement) {
      static tag = 'test-template';
      get template() { return '<div>Template</div>'; }
    }
    if (!customElements.get('test-template')) customElements.define('test-template', TemplateComponent);
    
    const { component: tmpl, container: container2 } = await createAndRenderComponent('test-template');
    assert(tmpl.textContent === 'Template', 'template property used');
    container2.remove();
    
    // No template or render - use innerHTML
    class InnerHTMLComponent extends Component(HTMLElement) {
      static tag = 'test-innerhtml';
    }
    if (!customElements.get('test-innerhtml')) customElements.define('test-innerhtml', InnerHTMLComponent);
    
    const container3 = document.createElement('div');
    document.body.appendChild(container3);
    container3.innerHTML = '<test-innerhtml>InnerHTML</test-innerhtml>';
    const innerComp = container3.querySelector('test-innerhtml');
    await innerComp.rendered;
    
    assert(innerComp.textContent === 'InnerHTML', 'innerHTML preserved');
    container3.remove();
  });


  // ==================== NESTED COMPONENTS ====================

  test('Component - nested components, data passing, findMethod', async () => {
    // Combines nested component tests
    let parentMethodCalled = false;
    
    class ParentComponent extends Component(HTMLElement) {
      static tag = 'test-parent';
      handleAction() { parentMethodCalled = true; }
      render() {
        return html`
          <div>
            <test-child data-msg="Hello"></test-child>
          </div>
        `;
      }
    }
    
    class ChildComponent extends Component(HTMLElement) {
      static tag = 'test-child';
      render() {
        const msg = this.getAttribute('data-msg');
        return html`<button onclick="{this.findMethod('handleAction')}">${msg}</button>`;
      }
    }
    
    if (!customElements.get('test-parent')) customElements.define('test-parent', ParentComponent);
    if (!customElements.get('test-child')) customElements.define('test-child', ChildComponent);
    
    const { component: parent, container } = await createAndRenderComponent('test-parent');
    const child = parent.querySelector('test-child');
    const button = child.querySelector('button');
    
    assert(button.textContent === 'Hello', 'Data passed via attributes');
    
    button.click();
    assert(parentMethodCalled, 'findMethod finds parent method');
    
    container.remove();
  });

  // ==================== ERROR HANDLING ====================

  test('Component - error handling (render, added, removed, event)', async () => {
    // Combines error handling tests - ensure they don't crash
    
    class ErrorRenderComponent extends Component(HTMLElement) {
      static tag = 'test-error-render';
      render() { throw new Error('Render error'); }
    }
    if (!customElements.get('test-error-render')) customElements.define('test-error-render', ErrorRenderComponent);
    
    const container1 = document.createElement('div');
    document.body.appendChild(container1);
    const comp1 = document.createElement('test-error-render');
    container1.appendChild(comp1);
    await flushEffects();
    assert(comp1.isConnected, 'Component remains connected despite render error');
    container1.remove();
    
    class ErrorAddedComponent extends Component(HTMLElement) {
      static tag = 'test-error-added';
      added() { throw new Error('Added error'); }
      render() { return html`<div>Content</div>`; }
    }
    if (!customElements.get('test-error-added')) customElements.define('test-error-added', ErrorAddedComponent);
    
    const { component: comp2, container: container2 } = await createAndRenderComponent('test-error-added');
    assert(comp2.isConnected, 'Component connected despite added() error');
    container2.remove();
    
    class ErrorRemovedComponent extends Component(HTMLElement) {
      static tag = 'test-error-removed';
      removed() { throw new Error('Removed error'); }
      render() { return html`<div>Content</div>`; }
    }
    if (!customElements.get('test-error-removed')) customElements.define('test-error-removed', ErrorRemovedComponent);
    
    const { component: comp3, container: container3 } = await createAndRenderComponent('test-error-removed');
    container3.remove();
    await flushEffects();
    assert(!comp3.isConnected, 'Component removed despite removed() error');
    
    // Event handler error
    class ErrorEventComponent extends Component(HTMLElement) {
      static tag = 'test-error-event';
      handleError() { throw new Error('Event error'); }
      render() { return html`<button onclick="{this.handleError}">Click</button>`; }
    }
    if (!customElements.get('test-error-event')) customElements.define('test-error-event', ErrorEventComponent);
    
    const { component: comp4, container: container4 } = await createAndRenderComponent('test-error-event');
    const btn = comp4.querySelector('button');
    assert(btn, 'Component renders with error-throwing handler');
    container4.remove();
  });

  // ==================== SPECIAL CASES ====================

  test('Component - multiple reactive expressions, computed, update()', async () => {
    // Combines special reactive scenarios
    class MultiReactiveComponent extends Component(HTMLElement) {
      static tag = 'test-multi-reactive';
      constructor() {
        super();
        this.state = this.reactive({ 
          first: 'Hello', 
          last: 'World',
          items: ['a', 'b', 'c']
        });
      }
      get fullName() {
        return `${this.state.first} ${this.state.last}`;
      }
      render() {
        return html`
          <div data-name>{this.state.first} {this.state.last}</div>
          <div data-computed>{this.fullName}</div>
          <div data-items>{this.state.items.length}</div>
        `;
      }
    }
    if (!customElements.get('test-multi-reactive')) customElements.define('test-multi-reactive', MultiReactiveComponent);
    
    const { component, container } = await createAndRenderComponent('test-multi-reactive');
    
    assert(component.querySelector('[data-name]').textContent === 'Hello World', 'Multiple expressions');
    assert(component.querySelector('[data-computed]').textContent === 'Hello World', 'Computed property');
    assert(component.querySelector('[data-items]').textContent === '3', 'Array property');
    
    // Test manual update
    component.state.first = 'Hi';
    component.update();
    await flushEffects();
    
    assert(component.querySelector('[data-name]').textContent === 'Hi World', 'update() works');
    assert(component.querySelector('[data-computed]').textContent === 'Hi World', 'Computed updated');
    
    container.remove();
  });

  test('Component - non-reactive component with expressions', async () => {
    // Test non-reactive components still work
    class NonReactiveComponent extends Component(HTMLElement) {
      static tag = 'test-non-reactive';
      constructor() {
        super();
        this.value = 'Static';
      }
      render() {
        return html`<div>{this.value}</div>`;
      }
    }
    if (!customElements.get('test-non-reactive')) customElements.define('test-non-reactive', NonReactiveComponent);
    
    const { component, container } = await createAndRenderComponent('test-non-reactive');
    assert(component.textContent === 'Static', 'Non-reactive expression evaluates');
    
    container.remove();
  });

  test('Component - renderedCallback, pre/post hooks', async () => {
    // Test all hooks are called
    let renderedCallbackCalled = false;
    
    class HooksComponent extends Component(HTMLElement) {
      static tag = 'test-all-hooks';
      constructor() {
        super();
        this.preCount = 0;
        this.postCount = 0;
      }
      pre() { this.preCount++; }
      post() { this.postCount++; }
      renderedCallback() { renderedCallbackCalled = true; }
      render() { return html`<div>Hooks</div>`; }
    }
    if (!customElements.get('test-all-hooks')) customElements.define('test-all-hooks', HooksComponent);
    
    const { component, container } = await createAndRenderComponent('test-all-hooks');
    
    assert(component.preCount > 0, 'pre() called');
    assert(component.postCount > 0, 'post() called');
    assert(renderedCallbackCalled, 'renderedCallback() called');
    
    container.remove();
  });

  // ==================== FRAMEWORK COMPONENTS ====================

  test('Component - inline, property, relation components', async () => {
    // Test special framework component types
    const model = new Model({ id: 'inline-123', name: 'Test' });
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Inline component (about attribute)
    container.innerHTML = '<div about="inline-123">Content</div>';
    const inline = container.firstChild;
    
    // Property component (property attribute)
    const propComp = document.createElement('span');
    propComp.setAttribute('property', 'name');
    propComp.model = model;
    container.appendChild(propComp);
    
    // Relation component (rel attribute)
    const relComp = document.createElement('span');
    relComp.setAttribute('rel', 'related');
    relComp.model = model;
    container.appendChild(relComp);
    
    await flushEffects();
    
    // Just verify they don't crash - actual functionality tested in dedicated files
    assert(inline, 'Inline component exists');
    assert(propComp, 'Property component exists');
    assert(relComp, 'Relation component exists');
    
    container.remove();
  });

  // ==================== COVERAGE-SPECIFIC TESTS ====================

  test('Component - auto-detect reactive state (lines 291-292)', async () => {
    // Direct test for reactive state auto-detection
    class LateReactiveComponent extends Component(HTMLElement) {
      static tag = 'test-late-reactive';
      constructor() {
        super();
        // Assign reactive state AFTER construction but during _process
        this.state = reactive({ value: 'reactive' });
      }
      render() { return html`<div>{this.state.value}</div>`; }
    }
    if (!customElements.get('test-late-reactive')) customElements.define('test-late-reactive', LateReactiveComponent);
    
    const { component, container } = await createAndRenderComponent('test-late-reactive');
    assert(component.textContent === 'reactive', 'Late reactive state detected');
    
    component.state.value = 'updated';
    await flushEffects();
    assert(component.textContent === 'updated', 'Late reactive state is reactive');
    
    container.remove();
  });

  test('Component - skip template inside veda-if/veda-loop (lines 310-316)', async () => {
    // Test template skip logic for framework components
    class SkipTemplateComponent extends Component(HTMLElement) {
      static tag = 'test-skip-template';
      render() {
        return html`
          <div>
            <veda-if condition="true">
              <template>Should be skipped</template>
            </veda-if>
            <veda-loop>
              <template>Should be skipped</template>
            </veda-loop>
          </div>
        `;
      }
    }
    if (!customElements.get('test-skip-template')) customElements.define('test-skip-template', SkipTemplateComponent);
    
    const { component, container } = await createAndRenderComponent('test-skip-template');
    assert(component.isConnected, 'Component with nested framework components renders');
    
    container.remove();
  });

  test('Component - DOM traversal without nextSibling (lines 413-416)', async () => {
    // Test deeply nested components without siblings
    class DeepParent extends Component(HTMLElement) {
      static tag = 'test-deep-parent';
      render() { return html`<div><test-deep-child></test-deep-child></div>`; }
    }
    
    class DeepChild extends Component(HTMLElement) {
      static tag = 'test-deep-child';
      render() { return html`<div><test-deep-grandchild></test-deep-grandchild></div>`; }
    }
    
    class DeepGrandchild extends Component(HTMLElement) {
      static tag = 'test-deep-grandchild';
      render() { return html`<span>Deep</span>`; }
    }
    
    if (!customElements.get('test-deep-parent')) customElements.define('test-deep-parent', DeepParent);
    if (!customElements.get('test-deep-child')) customElements.define('test-deep-child', DeepChild);
    if (!customElements.get('test-deep-grandchild')) customElements.define('test-deep-grandchild', DeepGrandchild);
    
    const { component, container } = await createAndRenderComponent('test-deep-parent');
    const grandchild = component.querySelector('test-deep-grandchild');
    
    assert(grandchild && grandchild.textContent === 'Deep', 'Deeply nested component renders');
    
    container.remove();
  });

  test('Component - expression evaluation error with invalid syntax', async () => {
    // Test expression parser handles malformed expressions
    class InvalidExprComponent extends Component(HTMLElement) {
      static tag = 'test-invalid-expr';
      render() {
        return html`<button onclick="{this.method.that.doesnt.exist()}">Click</button>`;
      }
    }
    if (!customElements.get('test-invalid-expr')) customElements.define('test-invalid-expr', InvalidExprComponent);
    
    const { component, container } = await createAndRenderComponent('test-invalid-expr');
    const btn = component.querySelector('button');
    
    assert(btn, 'Component renders despite invalid expression');
    
    container.remove();
  });

  test('Component - reactive attribute on veda-if', async () => {
    // Test reactive attributes work on framework components
    class ReactiveIfComponent extends Component(HTMLElement) {
      static tag = 'test-reactive-if';
      constructor() {
        super();
        this.state = this.reactive({ show: true });
      }
      render() {
        return html`<veda-if condition="{this.state.show}"><div>Content</div></veda-if>`;
      }
    }
    if (!customElements.get('test-reactive-if')) customElements.define('test-reactive-if', ReactiveIfComponent);
    
    const { component, container } = await createAndRenderComponent('test-reactive-if');
    const ifComp = component.querySelector('veda-if');
    
    assert(ifComp, 'veda-if with reactive attribute renders');
    
    container.remove();
  });

  test('Component - text with trailing static content', async () => {
    // Test text node with static content after expression
    class TrailingTextComponent extends Component(HTMLElement) {
      static tag = 'test-trailing-text';
      constructor() {
        super();
        this.state = this.reactive({ name: 'Test' });
      }
      render() {
        return html`<div>Hello {this.state.name}!</div>`;
      }
    }
    if (!customElements.get('test-trailing-text')) customElements.define('test-trailing-text', TrailingTextComponent);
    
    const { component, container } = await createAndRenderComponent('test-trailing-text');
    
    assert(component.textContent === 'Hello Test!', 'Trailing static content preserved');
    
    container.remove();
  });

  test('Component - non-reactive attributes evaluated once', async () => {
    // Test non-reactive attributes don't create effects
    let evalCount = 0;
    
    class NonReactiveAttrComponent extends Component(HTMLElement) {
      static tag = 'test-non-reactive-attr';
      constructor() {
        super();
        this.value = 'test';
      }
      getValue() {
        evalCount++;
        return this.value;
      }
      render() {
        return html`<div data-value="${this.getValue()}">Content</div>`;
      }
    }
    if (!customElements.get('test-non-reactive-attr')) customElements.define('test-non-reactive-attr', NonReactiveAttrComponent);
    
    const { component, container } = await createAndRenderComponent('test-non-reactive-attr');
    const initialCount = evalCount;
    
    component.update();
    await flushEffects();
    
    assert(evalCount === initialCount, 'Non-reactive attribute not re-evaluated');
    
    container.remove();
  });

  test('Component - customized built-in element with is attribute', async () => {
    // Test is= attribute for customized built-ins
    class CustomButton extends Component(HTMLButtonElement) {
      static tag = 'custom-button';
      render() { return html`Enhanced`; }
    }
    if (!customElements.get('custom-button')) {
      customElements.define('custom-button', CustomButton, { extends: 'button' });
    }
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    const btn = document.createElement('button', { is: 'custom-button' });
    container.appendChild(btn);
    await btn.rendered;
    
    assert(btn.textContent.includes('Enhanced'), 'Customized built-in works');
    
    container.remove();
  });

};

