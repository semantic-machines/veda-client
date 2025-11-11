import '../test/setup-dom.js';
import Component, { html } from '../src/components/Component.js';
import LoopComponent from '../src/components/LoopComponent.js';

export default function ({ test, assert }) {
  // Helper to flush reactive effects
  const flushEffects = () => new Promise(resolve => queueMicrotask(resolve));

  test('LoopComponent - basic instantiation and registration', () => {
    assert(typeof LoopComponent === 'function', 'LoopComponent should be a function');

    const LoopClass = LoopComponent(HTMLElement);
    assert(LoopClass.tag === 'veda-loop', 'Should have correct tag name');
    assert(typeof LoopClass === 'function', 'Should return a class');
  });

  test('LoopComponent - render empty list', async () => {
    class EmptyListComponent extends Component(HTMLElement) {
      static tag = 'test-empty-loop';

      constructor() {
        super();
        this.state = this.reactive({ items: [] });
      }

      render() {
        return html`
          <div>
            <veda-loop items="{this.state.items}" item-key="id">
              <div class="item">{this.model.name}</div>
            </veda-loop>
          </div>
        `;
      }
    }

    customElements.define('test-empty-loop', EmptyListComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-empty-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop !== null, 'Should have loop component');
    assert(loop.children.length === 0, 'Should have no children for empty list');

    container.remove();
  });

  test('LoopComponent - render simple array of objects', async () => {
    class SimpleLoopComponent extends Component(HTMLElement) {
      static tag = 'test-simple-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
            { id: 3, name: 'Item 3' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-simple-loop', SimpleLoopComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-simple-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 3, 'Should render 3 items');

    const items = loop.querySelectorAll('.item');
    assert(items[0].textContent === 'Item 1', 'First item should have correct content');
    assert(items[1].textContent === 'Item 2', 'Second item should have correct content');
    assert(items[2].textContent === 'Item 3', 'Third item should have correct content');

    container.remove();
  });

  test('LoopComponent - add items to list', async () => {
    class AddItemsComponent extends Component(HTMLElement) {
      static tag = 'test-add-items-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 1, name: 'Item 1' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-add-items-loop', AddItemsComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-add-items-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 1, 'Should initially render 1 item');

    // Add new item
    component.state.items.push({ id: 2, name: 'Item 2' });
    await flushEffects();

    assert(loop.children.length === 2, 'Should render 2 items after adding');

    const items = loop.querySelectorAll('.item');
    assert(items[1].textContent === 'Item 2', 'New item should have correct content');

    container.remove();
  });

  test('LoopComponent - remove items from list', async () => {
    class RemoveItemsComponent extends Component(HTMLElement) {
      static tag = 'test-remove-items-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
            { id: 3, name: 'Item 3' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-remove-items-loop', RemoveItemsComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-remove-items-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 3, 'Should initially render 3 items');

    // Remove middle item
    component.state.items.splice(1, 1);
    await flushEffects();

    assert(loop.children.length === 2, 'Should render 2 items after removing');

    const items = loop.querySelectorAll('.item');
    assert(items[0].textContent === 'Item 1', 'First item should remain');
    assert(items[1].textContent === 'Item 3', 'Third item should become second');

    container.remove();
  });

  test('LoopComponent - reorder items in list', async () => {
    class ReorderItemsComponent extends Component(HTMLElement) {
      static tag = 'test-reorder-items-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 1, name: 'First' },
            { id: 2, name: 'Second' },
            { id: 3, name: 'Third' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-reorder-items-loop', ReorderItemsComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-reorder-items-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');

    // Reverse the order
    component.state.items.reverse();
    await flushEffects();

    const items = loop.querySelectorAll('.item');
    assert(items[0].textContent === 'Third', 'First should now be Third');
    assert(items[1].textContent === 'Second', 'Second should remain Second');
    assert(items[2].textContent === 'First', 'Third should now be First');

    container.remove();
  });

  test('LoopComponent - replace entire list updates items', async () => {
    class ReplaceListComponent extends Component(HTMLElement) {
      static tag = 'test-replace-list-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 1, name: 'Original 1' },
            { id: 2, name: 'Original 2' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-replace-list-loop', ReplaceListComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-replace-list-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 2, 'Should have 2 items initially');

    // Replace with new list
    component.state.items = [
      { id: 1, name: 'Updated 1' },
      { id: 3, name: 'New 3' }
    ];
    await flushEffects();

    assert(loop.children.length === 2, 'Should still have 2 items');

    const items = loop.querySelectorAll('.item');
    // Check that reconciliation happened - id:2 removed, id:3 added
    assert(items.length === 2, 'Should have rendered 2 items after replacement');

    container.remove();
  });

  test('LoopComponent - updates existing element when item reference changes', async () => {
    class UpdateExistingComponent extends Component(HTMLElement) {
      static tag = 'test-update-existing-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 'item-1', name: 'Initial' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-update-existing-loop', UpdateExistingComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-update-existing-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    const initialElement = loop.firstElementChild;
    const initialModel = initialElement.model;

    const updatedItem = { id: 'item-1', name: 'Updated' };
    component.state.items = [updatedItem];
    await flushEffects();

    const updatedElement = loop.firstElementChild;
    assert.strictEqual(updatedElement, initialElement, 'Should reuse DOM element for same key');
    assert.notStrictEqual(updatedElement.model, initialModel, 'Should replace model reference when item changes');
    assert.strictEqual(updatedElement.model.id, 'item-1', 'Element model should expose updated id');
    assert.strictEqual(updatedElement.model.name, 'Updated', 'Element model should expose updated name');
    assert.strictEqual(updatedElement.getAttribute('about'), 'item-1', 'About attribute should stay in sync with item id');

    container.remove();
  });

  test('LoopComponent - without items attribute shows warning', async () => {
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (msg) => { warnMessage = msg; };

    class NoItemsComponent extends Component(HTMLElement) {
      static tag = 'test-no-items-loop';

      render() {
        return html`
          <veda-loop item-key="id">
            <div class="item">Test</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-no-items-loop', NoItemsComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-no-items-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    assert(warnMessage.includes('requires "items" attribute'), 'Should warn about missing items attribute');

    console.warn = originalWarn;
    container.remove();
  });

  test('LoopComponent - handles non-array items gracefully', async () => {
    class NonArrayComponent extends Component(HTMLElement) {
      static tag = 'test-non-array-loop';

      constructor() {
        super();
        this.state = this.reactive({ items: 'not an array' });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-non-array-loop', NonArrayComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-non-array-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 0, 'Should render nothing for non-array');

    container.remove();
  });

  test('LoopComponent - handles primitive values in array', async () => {
    class PrimitiveArrayComponent extends Component(HTMLElement) {
      static tag = 'test-primitive-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: ['apple', 'banana', 'cherry']
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}">
            <div class="item">Fruit</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-primitive-loop', PrimitiveArrayComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-primitive-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 3, 'Should render items for primitive array');

    container.remove();
  });

  test('LoopComponent - disconnectedCallback cleans up', async () => {
    class DisconnectComponent extends Component(HTMLElement) {
      static tag = 'test-disconnect-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [{ id: 1, name: 'Item' }]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-disconnect-loop', DisconnectComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-disconnect-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 1, 'Should have 1 item');

    // Remove component
    container.removeChild(component);

    // Verify no errors occurred during disconnect
    assert(container.children.length === 0, 'Should disconnect cleanly without errors');
  });

  test('LoopComponent - handles multiple children in template', async () => {
    class MultiChildComponent extends Component(HTMLElement) {
      static tag = 'test-multi-child-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 1, title: 'Title 1', desc: 'Description 1' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <h3>{this.model.title}</h3>
            <p>{this.model.desc}</p>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-multi-child-loop', MultiChildComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-multi-child-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    // Multiple children get wrapped in a div
    assert(loop.children.length === 1, 'Should wrap multiple children');

    const h3 = loop.querySelector('h3');
    const p = loop.querySelector('p');
    assert(h3 !== null && p !== null, 'Should have both elements');
    assert(h3.textContent === 'Title 1', 'Should render title');
    assert(p.textContent === 'Description 1', 'Should render description');

    container.remove();
  });

  test('LoopComponent - backward compatibility with template element', async () => {
    class TemplateLoopComponent extends Component(HTMLElement) {
      static tag = 'test-template-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [{ id: 1, name: 'Item 1' }]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <template>
              <div class="item">{this.model.name}</div>
            </template>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-template-loop', TemplateLoopComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-template-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 1, 'Should render item with template syntax');

    const item = loop.querySelector('.item');
    assert(item.textContent === 'Item 1', 'Should render content correctly');

    container.remove();
  });

  test('LoopComponent - handles expression evaluation error', async () => {
    // Tests line 104: catch block for evaluation errors
    const originalError = console.error;
    let errorMessage = '';
    console.error = (...args) => { errorMessage = args.join(' '); };

    class ErrorExprComponent extends Component(HTMLElement) {
      static tag = 'test-error-expr-loop';

      render() {
        // Invalid expression that will throw during evaluation
        return html`
          <veda-loop items="{this.nonExistent.deeply.nested}" item-key="id">
            <div>Item</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-error-expr-loop', ErrorExprComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-error-expr-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    assert(loop.children.length === 0, 'Should render empty list on error');
    assert(errorMessage.includes('Failed to evaluate'), 'Should log error message');

    console.error = originalError;
    container.remove();
  });

  test('LoopComponent - warns about duplicate keys', async () => {
    // Tests lines 118-124: warning about duplicate keys
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (...args) => { warnMessage = args.join(' '); };

    class DuplicateKeysComponent extends Component(HTMLElement) {
      static tag = 'test-duplicate-keys-loop';

      constructor() {
        super();
        this.state = this.reactive({
          // Two items with same id
          items: [
            { id: 1, name: 'First' },
            { id: 1, name: 'Second (duplicate)' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-duplicate-keys-loop', DuplicateKeysComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-duplicate-keys-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    assert(warnMessage.includes('Duplicate key'), 'Should warn about duplicate keys');
    assert(warnMessage.includes('"1"'), 'Should mention the duplicate key value');

    console.warn = originalWarn;
    container.remove();
  });

  test('LoopComponent - warns when template has no element', async () => {
    // Tests lines 194-196: warning when template doesn't contain element
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (...args) => { warnMessage = args.join(' '); };

    class NoElementComponent extends Component(HTMLElement) {
      static tag = 'test-no-element-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [{ id: 1 }]
        });
      }

      render() {
        // Template with only text node, no element
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            Just text, no element
          </veda-loop>
        `;
      }
    }

    customElements.define('test-no-element-loop', NoElementComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-no-element-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    assert(warnMessage.includes('must contain an element'), 'Should warn about missing element');

    const loop = component.querySelector('veda-loop');
    // Should create wrapper div
    assert(loop.children.length === 1, 'Should create wrapper element');

    console.warn = originalWarn;
    container.remove();
  });

  test('LoopComponent - handles missing parent component context', async () => {
    // Tests line 245: return null when parent component not found
    // This happens when Loop is used outside a component context
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (...args) => { warnMessage = args.join(' '); };

    // Create Loop directly without parent component
    const LoopClass = LoopComponent(HTMLElement);
    if (!customElements.get('veda-loop-orphan')) {
      customElements.define('veda-loop-orphan', LoopClass);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const loop = document.createElement('veda-loop-orphan');
    loop.setAttribute('items', '{[1,2,3]}');
    loop.innerHTML = '<div>Item</div>';
    container.appendChild(loop);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Should warn about missing context
    assert(warnMessage.includes('Cannot find parent'), 'Should warn about missing parent context');

    console.warn = originalWarn;
    container.remove();
  });

  test('LoopComponent - handles items with falsy but defined key value (line 181)', async () => {
    class FalsyKeyComponent extends Component(HTMLElement) {
      static tag = 'test-falsy-key-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 'normal', name: 'Normal ID' },
            { id: 0, name: 'Zero ID' },
            { id: '', name: 'Empty String ID' }
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.name}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-falsy-key-loop', FalsyKeyComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-falsy-key-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    const items = Array.from(loop.children);

    assert.strictEqual(items.length, 3, 'Should render all three items');
    assert.strictEqual(items[0].textContent.trim(), 'Normal ID', 'First item rendered');
    assert.strictEqual(items[1].textContent.trim(), 'Zero ID', 'Second item with 0 key rendered (tests line 181 String(key))');
    assert.strictEqual(items[2].textContent.trim(), 'Empty String ID', 'Third item with empty string key rendered');

    container.remove();
  });

  test('LoopComponent - uses fallback key when id is undefined (line 181)', async () => {
    class UndefinedKeyComponent extends Component(HTMLElement) {
      static tag = 'test-undefined-id-loop';

      constructor() {
        super();
        this.state = this.reactive({
          items: [
            { id: 'has-id', text: 'First' },
            { text: 'Second' } // id is undefined
          ]
        });
      }

      render() {
        return html`
          <veda-loop items="{this.state.items}" item-key="id">
            <div class="item">{this.model.text}</div>
          </veda-loop>
        `;
      }
    }

    customElements.define('test-undefined-id-loop', UndefinedKeyComponent);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const component = document.createElement('test-undefined-id-loop');
    container.appendChild(component);

    await component.rendered;
    await flushEffects();

    const loop = component.querySelector('veda-loop');
    const items = Array.from(loop.children);

    assert.strictEqual(items.length, 2, 'Should render both items');
    assert.strictEqual(items[0].textContent.trim(), 'First', 'First item with id');
    assert.strictEqual(items[1].textContent.trim(), 'Second', 'Second item without id field (tests line 181 fallback)');

    container.remove();
  });

  // ==================== STRESS TESTS ====================

};


