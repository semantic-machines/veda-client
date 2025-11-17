/**
 * Parametrized Component Tests
 * Test various combinations of attributes, events, and data types
 */

import './setup-dom.js';
import Component, { html, reactive } from '../src/components/Component.js';
import { flushEffects } from '../src/Effect.js';
import { createTestComponent } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== PARAMETRIZED ATTRIBUTE TESTS ====================

  const attributeTestCases = [
    { name: 'id', initial: 'test-id', updated: 'new-id', type: 'string' },
    { name: 'class', initial: 'btn primary', updated: 'btn secondary', type: 'string' },
    { name: 'title', initial: 'Tooltip', updated: 'New Tooltip', type: 'string' },
    { name: 'data-value', initial: '42', updated: '100', type: 'string' },
    { name: 'data-json', initial: '{"a":1}', updated: '{"b":2}', type: 'string' },
    { name: 'aria-label', initial: 'Close', updated: 'Open', type: 'string' },
    { name: 'aria-expanded', initial: 'false', updated: 'true', type: 'boolean' },
    { name: 'role', initial: 'button', updated: 'link', type: 'string' },
    { name: 'tabindex', initial: '0', updated: '-1', type: 'string' },
    { name: 'style', initial: 'color: red', updated: 'color: blue', type: 'string' },
  ];

  attributeTestCases.forEach(({ name, initial, updated, type }) => {
    test(`Parametrized - reactive attribute [${name}]`, async () => {
      class TestComponent extends Component(HTMLElement) {
        constructor() {
          super();
          this.state = reactive({ attr: initial });
        }
        render() {
          return html`<div ${name}="{this.state.attr}">Content</div>`;
        }
      }

      const { component, cleanup } = await createTestComponent(TestComponent);
      await flushEffects();

      const div = component.querySelector('div');
      assert(div !== null, `Element should exist for ${name}`);

      const initialValue = div.getAttribute(name);
      assert(initialValue === initial || initialValue === '',
        `Initial ${name} should be "${initial}", got "${initialValue}"`);

      // Update
      component.state.attr = updated;
      await flushEffects();

      const updatedValue = div.getAttribute(name);
      assert(updatedValue === updated || (type === 'boolean' && updatedValue !== null),
        `Updated ${name} should be "${updated}", got "${updatedValue}"`);

      cleanup();
    });
  });

  // ==================== PARAMETRIZED EVENT TESTS ====================

  const eventTestCases = [
    { event: 'onclick', trigger: 'click', type: 'mouse' },
    { event: 'ondblclick', trigger: 'dblclick', type: 'mouse' },
    { event: 'onmousedown', trigger: 'mousedown', type: 'mouse' },
    { event: 'onmouseup', trigger: 'mouseup', type: 'mouse' },
    { event: 'onmouseover', trigger: 'mouseover', type: 'mouse' },
    { event: 'onmouseout', trigger: 'mouseout', type: 'mouse' },
    // Note: input/change/focus/blur events are complex in test environment
    // They require real user interaction or specific element states
    // Tested separately in Component.test.js
  ];

  eventTestCases.forEach(({ event, trigger, type, element = 'button' }) => {
    test(`Parametrized - reactive event [${event}]`, async () => {
      class TestComponent extends Component(HTMLElement) {
        constructor() {
          super();
          this.triggered = false;
        }

        handleEvent(e) {
          this.triggered = true;
        }

        render() {
          return html`<${element} ${event}="{this.handleEvent}">Test</${element}>`;
        }
      }

      const { component, cleanup } = await createTestComponent(TestComponent);
      await flushEffects();

      const el = component.querySelector(element);
      assert(el !== null, `Element ${element} should exist`);
      assert(!component.triggered, 'Should not be triggered initially');

      // Trigger event
      const evt = new MouseEvent(trigger, { bubbles: true, cancelable: true });
      el.dispatchEvent(evt);

      await flushEffects();

      assert(component.triggered, `${event} should trigger handler`);

      cleanup();
    });
  });

  // ==================== PARAMETRIZED DATA TYPE TESTS ====================

  const dataTypeTestCases = [
    { type: 'string', initial: 'hello', updated: 'world', expected: ['hello', 'world'] },
    { type: 'number', initial: 42, updated: 100, expected: ['42', '100'] },
    { type: 'boolean', initial: true, updated: false, expected: ['true', 'false'] },
    { type: 'null', initial: null, updated: 'not-null', expected: ['', 'not-null'] },
    { type: 'undefined', initial: undefined, updated: 'defined', expected: ['', 'defined'] },
    { type: 'array', initial: [1, 2, 3], updated: [4, 5], expected: ['1,2,3', '4,5'] },
    { type: 'object', initial: { toString: () => 'obj1' }, updated: { toString: () => 'obj2' }, expected: ['obj1', 'obj2'] },
    { type: 'zero', initial: 0, updated: 1, expected: ['0', '1'] },
    { type: 'empty-string', initial: '', updated: 'filled', expected: ['', 'filled'] },
    { type: 'whitespace', initial: '  ', updated: 'text', expected: ['  ', 'text'] },
  ];

  dataTypeTestCases.forEach(({ type, initial, updated, expected }) => {
    test(`Parametrized - data type [${type}]`, async () => {
      class TestComponent extends Component(HTMLElement) {
        constructor() {
          super();
          this.state = reactive({ value: initial });
        }
        render() {
          return html`<div class="value">{this.state.value}</div>`;
        }
      }

      const { component, cleanup } = await createTestComponent(TestComponent);
      await flushEffects();

      const div = component.querySelector('.value');
      assert(div !== null, 'Element should exist');

      const initialText = div.textContent;
      assert(initialText === expected[0],
        `Initial value for ${type} should be "${expected[0]}", got "${initialText}"`);

      // Update
      component.state.value = updated;
      await flushEffects();

      const updatedText = div.textContent;
      assert(updatedText === expected[1],
        `Updated value for ${type} should be "${expected[1]}", got "${updatedText}"`);

      cleanup();
    });
  });

  // ==================== PARAMETRIZED BOOLEAN ATTRIBUTE TESTS ====================

  const booleanAttrTestCases = [
    // Boolean attributes: false for false/null/undefined/'false'
    // true for true/'true'/''/'attributeName'/non-empty strings
    { attr: 'disabled', element: 'button', truthy: [true, 'disabled', ''], falsy: [false, null, undefined, 'false'] },
    { attr: 'checked', element: 'input', truthy: [true, 'checked', ''], falsy: [false, null, undefined, 'false'] },
    { attr: 'readonly', element: 'input', truthy: [true, 'readonly', ''], falsy: [false, null, undefined, 'false'] },
    { attr: 'required', element: 'input', truthy: [true, 'required', ''], falsy: [false, null, undefined, 'false'] },
    { attr: 'hidden', element: 'div', truthy: [true, 'hidden', ''], falsy: [false, null, undefined, 'false'] },
    { attr: 'selected', element: 'option', truthy: [true, 'selected', ''], falsy: [false, null, undefined, 'false'] },
  ];

  booleanAttrTestCases.forEach(({ attr, element, truthy, falsy }) => {
    truthy.forEach((value, index) => {
      test(`Parametrized - boolean attr [${attr}] truthy case ${index}: ${JSON.stringify(value)}`, async () => {
        class TestComponent extends Component(HTMLElement) {
          constructor() {
            super();
            this.state = reactive({ bool: value });
          }
          render() {
            const typeAttr = element === 'input' ? ' type="text"' : '';
            return html`<${element}${typeAttr} ${attr}="{this.state.bool}">Test</${element}>`;
          }
        }

        const { component, cleanup } = await createTestComponent(TestComponent);
        await flushEffects();

        const el = component.querySelector(element);
        assert(el !== null, `${element} should exist`);

        // Check if attribute is present/true
        const hasAttr = el.hasAttribute(attr);
        const propValue = el[attr];

        // For boolean attributes, presence = true
        assert(hasAttr || propValue === true,
          `${attr} should be truthy for value ${JSON.stringify(value)}`);

        cleanup();
      });
    });

    falsy.forEach((value, index) => {
      test(`Parametrized - boolean attr [${attr}] falsy case ${index}: ${JSON.stringify(value)}`, async () => {
        class TestComponent extends Component(HTMLElement) {
          constructor() {
            super();
            this.state = reactive({ bool: value });
          }
          render() {
            const typeAttr = element === 'input' ? ' type="text"' : '';
            return html`<${element}${typeAttr} ${attr}="{this.state.bool}">Test</${element}>`;
          }
        }

        const { component, cleanup } = await createTestComponent(TestComponent);
        await flushEffects();

        const el = component.querySelector(element);
        assert(el !== null, `${element} should exist`);

        // Check if attribute is absent/false
        const propValue = el[attr];

        // For boolean attributes, false/null/undefined should make it false
        assert(propValue === false || propValue === null || propValue === undefined,
          `${attr} should be falsy for value ${JSON.stringify(value)}, got ${JSON.stringify(propValue)}`);

        cleanup();
      });
    });
  });

  // ==================== PARAMETRIZED REACTIVE COMBINATIONS ====================

  const combinationTestCases = [
    {
      name: 'text-and-attribute',
      render: (state) => html`<div title="{state.title}">{state.text}</div>`,
      initial: { title: 'Tooltip', text: 'Content' },
      updated: { title: 'New Tooltip', text: 'New Content' },
      check: (div, values) => {
        return div.getAttribute('title') === values.title && div.textContent === values.text;
      }
    },
    {
      name: 'multiple-attributes',
      render: (state) => html`<div id="{state.id}" class="{state.cls}" data-value="{state.data}">Test</div>`,
      initial: { id: 'test-1', cls: 'btn', data: '42' },
      updated: { id: 'test-2', cls: 'link', data: '100' },
      check: (div, values) => {
        return div.id === values.id &&
               div.className === values.cls &&
               div.getAttribute('data-value') === values.data;
      }
    },
    {
      name: 'nested-expressions',
      render: (state) => html`<div><span>{state.a}</span><span>{state.b}</span></div>`,
      initial: { a: 'A', b: 'B' },
      updated: { a: 'X', b: 'Y' },
      check: (div, values) => {
        const spans = div.querySelectorAll('span');
        return spans[0].textContent === values.a && spans[1].textContent === values.b;
      }
    },
  ];

  combinationTestCases.forEach(({ name, render, initial, updated, check }) => {
    test(`Parametrized - combination [${name}]`, async () => {
      class TestComponent extends Component(HTMLElement) {
        constructor() {
          super();
          this.state = reactive({ ...initial });
        }
        render() {
          return render(this.state);
        }
      }

      const { component, cleanup } = await createTestComponent(TestComponent);
      await flushEffects();

      const element = component.querySelector('div');
      assert(element !== null, 'Element should exist');
      assert(check(element, initial), `Initial state check failed for ${name}`);

      // Update
      Object.assign(component.state, updated);
      await flushEffects();

      assert(check(element, updated), `Updated state check failed for ${name}`);

      cleanup();
    });
  });

};

