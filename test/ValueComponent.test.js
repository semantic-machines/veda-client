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
    element.model = model;

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
    element.model = model;

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
};

