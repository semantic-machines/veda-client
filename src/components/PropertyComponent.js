import ValueComponent from './ValueComponent.js';
import {factories} from '../template/factories.js';
import {compileTemplate} from '../template/Template.js';

export default function PropertyComponent (Class = HTMLElement) {
  return class PropertyComponentClass extends ValueComponent(Class) {
    static observedAttributes = ['lang'];

    attributeChangedCallback (name, oldValue, newValue) {
      if (oldValue && oldValue !== newValue) {
        this._invalidateValueCache();
        super.render();
      }
    }

    renderValue (value, container, index) {
      if (typeof value === 'string') {
        const lang = document.documentElement.lang;
        this.setAttribute('lang', lang);
        const langSuffix = `^^${lang.toUpperCase()}`;

        if (value.endsWith(langSuffix)) {
          value = value.slice(0, -langSuffix.length);
        } else if (value.includes('^^') && value.length - value.lastIndexOf('^^') === 4) {
          return;
        }
      }

      const hasCustomContent = this._compiledTemplate || this.template?.trim();
      if (!hasCustomContent) {
        return super.renderValue(value, container, index);
      }

      const evalContext = this.state;
      Object.setPrototypeOf(evalContext, this);

      const compiled = this._compiledTemplate || compileTemplate(this.template);
      const instance = compiled.instantiate(
        evalContext,
        this,
        {values: this._templateValues || []},
      );
      const fragment = instance.fragment;
      const slot = fragment.querySelector('slot');
      // Sanitize to prevent XSS via {expr} patterns in data
      const valueText = value.toString().replace(/!\{/g, '!\u200B{');

      if (slot) {
        slot.replaceWith(document.createTextNode(valueText));
      } else {
        const node = fragment.firstElementChild;
        if (node) node.textContent = valueText;
      }

      container.appendChild(fragment);
      return {cleanup: () => instance.destroy(), instance};
    }
  };
}

factories.Property = PropertyComponent;
