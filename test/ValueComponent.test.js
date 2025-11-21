import '../test/setup-dom.js';
import {flushEffects} from '../src/Effect.js';
import Model from '../src/Model.js';
import ValueComponent from '../src/components/ValueComponent.js';

export default function ({ test, assert }) {

  test('ValueComponent - renders initial value and reacts to model changes', async () => {
    const ValueClass = ValueComponent(HTMLElement);
    if (!customElements.get('test-value-component')) {
      customElements.define('test-value-component', ValueClass);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const element = document.createElement('test-value-component');
    element.setAttribute('property', 'rdfs:label');

    const model = new Model();
    model['rdfs:label'] = ['First'];
    element.state.model = model;

    container.appendChild(element);

    await element.rendered;
    await flushEffects();

    assert(element.textContent === 'First', 'Should render initial value from model');

    model['rdfs:label'] = ['Updated'];
    await flushEffects();

    assert(element.textContent === 'Updated', 'Should update rendered value when model changes');

    container.remove();
  });

  test('ValueComponent - renders multiple values in order', async () => {
    const ValueClass = ValueComponent(HTMLElement);
    if (!customElements.get('test-multi-value-component')) {
      customElements.define('test-multi-value-component', ValueClass);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const element = document.createElement('test-multi-value-component');
    element.setAttribute('property', 'rdfs:label');

    const model = new Model();
    model['rdfs:label'] = ['Alpha', 'Beta'];
    element.state.model = model;

    container.appendChild(element);

    await element.rendered;
    await flushEffects();

    assert(element.textContent === 'AlphaBeta', 'Should render all values sequentially');

    container.remove();
  });

  test('ValueComponent - class structure', () => {
    const ValueClass = ValueComponent(HTMLElement);

    assert(typeof ValueClass === 'function', 'Should return a class');
    assert(typeof ValueClass.prototype.added === 'function', 'Should have added method');
    assert(typeof ValueClass.prototype.removed === 'function', 'Should have removed method');
    assert(typeof ValueClass.prototype.render === 'function', 'Should have render method');
    assert(typeof ValueClass.prototype.renderValue === 'function', 'Should have renderValue method');
  });

  test('ValueComponent - renders with shadow DOM (line 29)', async () => {
    // Test line 29: shadow attribute
    const ValueClass = ValueComponent(HTMLElement);
    if (!customElements.get('test-value-shadow')) {
      customElements.define('test-value-shadow', ValueClass);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const element = document.createElement('test-value-shadow');
    element.setAttribute('property', 'rdfs:label');
    element.setAttribute('shadow', ''); // Enable shadow DOM

    const model = new Model();
    model['rdfs:label'] = ['Shadow Content'];
    element.state.model = model;

    container.appendChild(element);

    await element.rendered;
    await flushEffects();

    // Check that shadowRoot was created
    assert(element.shadowRoot !== null, 'Should create shadow DOM');
    assert(element.shadowRoot.textContent === 'Shadow Content', 'Should render content in shadow DOM');

    container.remove();
  });

  test('ValueComponent - handles model without value (lines 32-34)', async () => {
    // Test lines 32-34: model.hasValue() check
    const ValueClass = ValueComponent(HTMLElement);
    if (!customElements.get('test-value-no-value')) {
      customElements.define('test-value-no-value', ValueClass);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const element = document.createElement('test-value-no-value');
    element.setAttribute('property', 'rdfs:label');

    const model = new Model();
    // Don't set 'rdfs:label' - model.hasValue() will return false
    element.state.model = model;

    container.appendChild(element);

    await element.rendered;
    await flushEffects();

    // Should render empty content
    assert(element.textContent === '', 'Should render empty when model has no value');

    container.remove();
  });

  test('ValueComponent - handles single non-array value (line 33)', async () => {
    // Test line 33: handle non-array value
    const ValueClass = ValueComponent(HTMLElement);
    if (!customElements.get('test-value-single')) {
      customElements.define('test-value-single', ValueClass);
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    const element = document.createElement('test-value-single');
    element.setAttribute('property', 'rdfs:label');

    const model = new Model();
    model['rdfs:label'] = 'Single Value'; // Not an array
    element.state.model = model;

    container.appendChild(element);

    await element.rendered;
    await flushEffects();

    assert(element.textContent === 'Single Value', 'Should handle single non-array value');

    container.remove();
  });
};

