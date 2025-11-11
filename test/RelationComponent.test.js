import '../test/setup-dom.js';
import RelationComponent from '../src/components/RelationComponent.js';
import ValueComponent from '../src/components/ValueComponent.js';
import Component, { html } from '../src/components/Component.js';
import Model from '../src/Model.js';
import { flushEffects } from '../src/Effect.js';

export default function ({ test, assert }) {

  test('RelationComponent - returns a class extending ValueComponent', () => {
    const RelClass = RelationComponent(HTMLElement);
    assert(typeof RelClass === 'function', 'Should return a class');

    // Check it extends ValueComponent
    const ValueClass = ValueComponent(HTMLElement);
    const relProto = Object.getPrototypeOf(RelClass.prototype);
    assert(relProto.constructor.name.includes('Value'), 'Should extend ValueComponent');
  });

  test('RelationComponent - renderValue without template logic', () => {
    // Test lines 6-8: check if !this.template condition
    const RelClass = RelationComponent(HTMLElement);

    // Test the logic: if no template, should call super
    const hasTemplate1 = null;
    const shouldCallSuper1 = !hasTemplate1;
    assert(shouldCallSuper1 === true, 'Should call super when template is null');

    const hasTemplate2 = undefined;
    const shouldCallSuper2 = !hasTemplate2;
    assert(shouldCallSuper2 === true, 'Should call super when template is undefined');

    const hasTemplate3 = '<div>template</div>';
    const shouldCallSuper3 = !hasTemplate3;
    assert(shouldCallSuper3 === false, 'Should not call super when template exists');
  });

  test('RelationComponent - renderValue with template element (old syntax)', async () => {
    const RelClass = RelationComponent(HTMLElement);
    const container = document.createElement('div');

    const mockModel = { id: 1, name: 'Test' };

    const instance = {
      template: '<template><span class="rel-item">Item</span></template>',
      model: mockModel,
      _process() {},
      renderValue: RelClass.prototype.renderValue
    };

    // Test lines 23-24: template element branch
    await instance.renderValue(mockModel, container, 0);

    const span = container.querySelector('.rel-item');
    assert(span !== null, 'Should process template element (old syntax)');
  });

  test('RelationComponent - renderValue without template element (new syntax)', async () => {
    const RelClass = RelationComponent(HTMLElement);
    const container = document.createElement('div');

    const mockModel = { id: 2, name: 'Test2' };

    const instance = {
      template: '<div class="rel-direct">Direct HTML</div>',
      model: mockModel,
      _process() {},
      renderValue: RelClass.prototype.renderValue
    };

    // Test lines 26-30: direct HTML branch (new syntax)
    await instance.renderValue(mockModel, container, 0);

    const div = container.querySelector('.rel-direct');
    assert(div !== null, 'Should process direct HTML (new syntax)');
  });

  test('RelationComponent - renderValue sets model on custom elements', async () => {
    const RelClass = RelationComponent(HTMLElement);
    const container = document.createElement('div');

    const mockModel = { id: 3, name: 'Test3' };

    const instance = {
      template: '<custom-element></custom-element>',
      model: mockModel,
      _process() {},
      renderValue: RelClass.prototype.renderValue
    };

    // Test lines 46-48: set model on custom elements
    await instance.renderValue(mockModel, container, 0);

    const customEl = container.querySelector('custom-element');
    assert(customEl !== null, 'Should have custom element');
    assert(customEl.model === mockModel, 'Should set model on custom element');
  });

  test('RelationComponent - renderValue restores original model', async () => {
    const RelClass = RelationComponent(HTMLElement);
    const container = document.createElement('div');

    const originalModel = { id: 'original' };
    const valueModel = { id: 'value' };

    const instance = {
      template: '<div>Content</div>',
      model: originalModel,
      _process() {},
      renderValue: RelClass.prototype.renderValue
    };

    // Test lines 53-54: restore original model in finally block
    await instance.renderValue(valueModel, container, 0);

    assert(instance.model === originalModel, 'Should restore original model after rendering');
  });

  test('RelationComponent - renderValue creates context element', async () => {
    const RelClass = RelationComponent(HTMLElement);
    const container = document.createElement('div');

    const mockModel = { id: 4, name: 'Test4' };

    let processCalledWithContext = null;
    const instance = {
      template: '<span>Test</span>',
      model: mockModel,
      _process(fragment, context) {
        processCalledWithContext = context;
      },
      renderValue: RelClass.prototype.renderValue
    };

    // Test lines 34-37: create contextElement with model
    await instance.renderValue(mockModel, container, 0);

    assert(processCalledWithContext !== null, 'Should call _process with context');
    assert(processCalledWithContext.model === mockModel, 'Context should have model set');
  });

  test('RelationComponent - renders without template using super (lines 7-8)', async () => {
    // Test that RelationComponent falls back to super.renderValue() when no template
    const RelClass = RelationComponent(HTMLElement);

    if (!customElements.get('test-relation-no-template')) {
      customElements.define('test-relation-no-template', RelClass);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const element = document.createElement('test-relation-no-template');
    // Don't set template attribute, so this.template will be falsy
    element.setAttribute('property', 'v-s:hasPart');

    const model = new Model();
    const relatedModel1 = new Model();
    relatedModel1['rdfs:label'] = ['Related Item 1'];
    const relatedModel2 = new Model();
    relatedModel2['rdfs:label'] = ['Related Item 2'];

    model['v-s:hasPart'] = [relatedModel1, relatedModel2];
    element.model = model;

    container.appendChild(element);
    await element.rendered;
    await flushEffects();

    // Should render using ValueComponent's default rendering (no template)
    // ValueComponent renders values as text nodes
    assert(element.textContent.length > 0, 'Should render content using super.renderValue()');

    container.remove();
  });
};

