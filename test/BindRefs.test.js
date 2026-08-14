import './setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {flushEffects} from '../src/Effect.js';
import {createTestComponent} from './helpers.js';

export default ({test, assert}) => {

  test('Component - ref attribute stores the element on this.refs', async () => {
    class RefComponent extends Component(HTMLElement) {
      render() {
        return html`<input ref="query" type="text"><button ref="ok">OK</button>`;
      }
    }

    const {component, cleanup} = await createTestComponent(RefComponent);
    assert(component.refs.query === component.querySelector('input'), 'refs.query should be the input');
    assert(component.refs.ok === component.querySelector('button'), 'refs.ok should be the button');
    cleanup();
  });

  test('Component - bind syncs input value both ways', async () => {
    class BindComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.q = 'hello';
      }
      render() {
        return html`<input id="q" bind="{this.state.q}">`;
      }
    }

    const {component, cleanup} = await createTestComponent(BindComponent);
    await flushEffects();

    const input = component.querySelector('#q');
    assert(input.value === 'hello', 'Input should take the state value');

    component.state.q = 'world';
    await flushEffects();
    assert(input.value === 'world', 'Input should follow state');

    input.value = 'typed';
    const view = input.ownerDocument.defaultView;
    input.dispatchEvent(new view.Event('input', {bubbles: true}));
    await flushEffects();
    assert(component.state.q === 'typed', 'State should follow input');
    cleanup();
  });

  test('Component - bind syncs checkbox checked', async () => {
    class BindCheckComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.on = false;
      }
      render() {
        return html`<input id="on" type="checkbox" bind="{this.state.on}">`;
      }
    }

    const {component, cleanup} = await createTestComponent(BindCheckComponent);
    await flushEffects();

    const input = component.querySelector('#on');
    assert(input.checked === false, 'Checkbox should start unchecked');

    input.checked = true;
    const view = input.ownerDocument.defaultView;
    input.dispatchEvent(new view.Event('change', {bubbles: true}));
    await flushEffects();
    assert(component.state.on === true, 'State should follow checkbox');
    cleanup();
  });

  test('Component - bind syncs radio group by value', async () => {
    class BindRadioComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.kind = 'open';
      }
      render() {
        return html`
          <input id="a" type="radio" name="kind-bind" value="open" bind="{this.state.kind}">
          <input id="b" type="radio" name="kind-bind" value="closed" bind="{this.state.kind}">
        `;
      }
    }

    const {component, cleanup} = await createTestComponent(BindRadioComponent);
    await flushEffects();

    const open = component.querySelector('#a');
    const closed = component.querySelector('#b');
    assert(open.checked === true, 'Matching radio should be checked');
    assert(closed.checked === false, 'Other radio should be unchecked');

    closed.checked = true;
    const view = closed.ownerDocument.defaultView;
    closed.dispatchEvent(new view.Event('change', {bubbles: true}));
    await flushEffects();
    assert(component.state.kind === 'closed', 'State should take the radio value');
    assert(open.checked === false, 'Previous radio should uncheck');
    cleanup();
  });

  test('Component - bind writes through optional chaining in the path', async () => {
    class BindOptComponent extends Component(HTMLElement) {
      constructor() {
        super();
        this.state.q = 'hello';
      }
      render() {
        return html`<input id="q" bind="{this.state?.q}">`;
      }
    }

    const {component, cleanup} = await createTestComponent(BindOptComponent);
    await flushEffects();

    const input = component.querySelector('#q');
    assert(input.value === 'hello', 'Input should take the state value');

    input.value = 'typed';
    const view = input.ownerDocument.defaultView;
    input.dispatchEvent(new view.Event('input', {bubbles: true}));
    await flushEffects();
    assert(component.state.q === 'typed', 'State should follow input through ?. path');
    cleanup();
  });
};
