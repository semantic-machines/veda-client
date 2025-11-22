import '../test/setup-dom.js';
import Component, {html} from '../src/components/Component.js';
import {flushEffects} from '../src/Effect.js';
import Model from '../src/Model.js';
import PropertyComponent from '../src/components/PropertyComponent.js';
import ValueComponent from '../src/components/ValueComponent.js';

const ensureDefined = (tag, Class) => {
  if (!customElements.get(tag)) {
    customElements.define(tag, Class);
  }
};

export default function ({ test, assert }) {

  test('PropertyComponent - returns a class extending ValueComponent', () => {
    const PropClass = PropertyComponent(HTMLElement);
    assert(typeof PropClass === 'function', 'Should return a class');
    assert(PropClass.observedAttributes.includes('lang'), 'Should observe lang attribute');

    const parentProto = Object.getPrototypeOf(PropClass.prototype);
    assert(parentProto.constructor.name.includes('ValueComponent'), 'Should extend ValueComponent prototype');
  });

  test('PropertyComponent - renders value for current language', async () => {
    const originalLang = document.documentElement.lang;
    document.documentElement.lang = 'en';

    class PropertyHost extends Component(HTMLElement) {
      static tag = 'test-property-host-render';

      constructor() {
        super();
        const model = new Model();
        model['v-s:title'] = ['Localized value^^EN'];
        this.state.model = model;
      }

      render() {
        return html`
          <div>
            <span property="v-s:title"></span>
          </div>
        `;
      }
    }

    ensureDefined(PropertyHost.tag, PropertyHost);

    const container = document.createElement('div');
    document.body.appendChild(container);

    try {
      const host = document.createElement(PropertyHost.tag);
      container.appendChild(host);

      await host.rendered;
      await flushEffects();

      const propertyEl = host.querySelector('[is$="property-component"]');
      assert(propertyEl !== null, 'Property component should be instantiated');
      assert.strictEqual(propertyEl.textContent.trim(), 'Localized value', 'Should render localized text without suffix');
      assert.strictEqual(propertyEl.getAttribute('lang'), 'en', 'Should set lang attribute to current language');
      assert.strictEqual(propertyEl.state.model, host.state.model, 'Should reuse host model instance');
    } finally {
      container.remove();
      document.documentElement.lang = originalLang;
    }
  });

  test('PropertyComponent - filters values that do not match lang', async () => {
    const originalLang = document.documentElement.lang;
    document.documentElement.lang = 'de';

    class PropertyHostFiltered extends Component(HTMLElement) {
      static tag = 'test-property-host-filtered';

      constructor() {
        super();
        const model = new Model();
        model['v-s:title'] = ['English^^EN', 'Deutsch^^DE'];
        this.model = model;
      }

      render() {
        return html`
          <div>
            <span property="v-s:title"></span>
          </div>
        `;
      }
    }

    ensureDefined(PropertyHostFiltered.tag, PropertyHostFiltered);

    const container = document.createElement('div');
    document.body.appendChild(container);

    try {
      const host = document.createElement(PropertyHostFiltered.tag);
      container.appendChild(host);

      await host.rendered;
      await flushEffects();

      const propertyEl = host.querySelector('[is$="property-component"]');
      assert(propertyEl !== null, 'Property component should be instantiated');
      assert.strictEqual(propertyEl.textContent.trim(), 'Deutsch', 'Should render value matching current language');

      document.documentElement.lang = 'en';
      propertyEl.setAttribute('lang', 'en'); // trigger attributeChanged
      await flushEffects();

      assert.strictEqual(propertyEl.textContent.trim(), 'English', 'Should update DOM when language changes');
    } finally {
      container.remove();
      document.documentElement.lang = originalLang;
    }
  });

  test('PropertyComponent - applies template slot when provided', async () => {
    const originalLang = document.documentElement.lang;
    document.documentElement.lang = 'en';

    class PropertyHostTemplate extends Component(HTMLElement) {
      static tag = 'test-property-host-template';

      constructor() {
        super();
        const model = new Model();
        model['v-s:title'] = ['Emphasized^^EN'];
        this.model = model;
      }

      render() {
        return html`
          <div>
            <span property="v-s:title">
              <strong class="value"><slot></slot></strong>
            </span>
          </div>
        `;
      }
    }

    ensureDefined(PropertyHostTemplate.tag, PropertyHostTemplate);

    const container = document.createElement('div');
    document.body.appendChild(container);

    try {
      const host = document.createElement(PropertyHostTemplate.tag);
      container.appendChild(host);

      await host.rendered;
      await flushEffects();

      const propertyEl = host.querySelector('[is$="property-component"]');
      const strong = propertyEl?.querySelector('strong.value');

      assert(propertyEl !== null, 'Property component should be instantiated');
      assert(strong, 'Strong element should be rendered from template');
      assert.strictEqual(strong.textContent, 'Emphasized', 'Slot should be replaced with value');
    } finally {
      container.remove();
      document.documentElement.lang = originalLang;
    }
  });

  test('PropertyComponent - renders custom template', async () => {
    const originalLang = document.documentElement.lang;
    document.documentElement.lang = 'en';

    class PropertyHostNoWrapper extends Component(HTMLElement) {
      static tag = 'test-property-host-nowrap';

      constructor() {
        super();
        const model = new Model();
        model['v-s:title'] = ['Direct HTML'];
        this.model = model;
      }

      render() {
        return html`
          <div>
            <span property="v-s:title">
              <em class="emphasis"></em>
            </span>
          </div>
        `;
      }
    }

    ensureDefined(PropertyHostNoWrapper.tag, PropertyHostNoWrapper);

    const container = document.createElement('div');
    document.body.appendChild(container);

    try {
      const host = document.createElement(PropertyHostNoWrapper.tag);
      container.appendChild(host);

      await host.rendered;
      await flushEffects();

      const propertyEl = host.querySelector('[is$="property-component"]');
      const em = propertyEl?.querySelector('em.emphasis');

      assert(propertyEl !== null, 'Property component should be instantiated');
      assert(em, 'Em element should be rendered from direct HTML');
      assert.strictEqual(em.textContent, 'Direct HTML', 'Should set textContent when no slot present');
    } finally {
      container.remove();
      document.documentElement.lang = originalLang;
    }
  });

  test('PropertyComponent - handles template with no firstElementChild (lines 47-51)', async () => {
    const originalLang = document.documentElement.lang;
    document.documentElement.lang = 'en';

    class PropertyHostTextOnly extends Component(HTMLElement) {
      static tag = 'test-property-host-textonly';

      constructor() {
        super();
        const model = new Model();
        model['v-s:title'] = ['Text Only'];
        this.model = model;
      }

      render() {
        return html`
          <div>
            <span property="v-s:title">
              Plain text template
            </span>
          </div>
        `;
      }
    }

    ensureDefined(PropertyHostTextOnly.tag, PropertyHostTextOnly);

    const container = document.createElement('div');
    document.body.appendChild(container);

    try {
      const host = document.createElement(PropertyHostTextOnly.tag);
      container.appendChild(host);

      await host.rendered;
      await flushEffects();

      const propertyEl = host.querySelector('[is$="property-component"]');

      assert(propertyEl !== null, 'Property component should be instantiated');
      assert(propertyEl.textContent.includes('Plain text'), 'Should render text-only template content');
    } finally {
      container.remove();
      document.documentElement.lang = originalLang;
    }
  });
};

