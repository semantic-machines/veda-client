import ValueComponent from './ValueComponent.js';

export default function PropertyComponent (Class = HTMLElement) {
  return class PropertyComponentClass extends ValueComponent(Class) {
    static observedAttributes = ['lang'];

    attributeChangedCallback (name, oldValue, newValue) {
      if (!oldValue || oldValue === newValue) return;
      super.render();
    }

    renderValue (value, container, index) {
      if (typeof value === 'string') {
        const lang = document.documentElement.lang;
        this.setAttribute('lang', lang);
        if (value.endsWith(`^^${lang.toUpperCase()}`)) {
          value = value.substring(0, value.indexOf('^^'));
        } else if (value.indexOf('^^') > 0 && value.indexOf('^^') === value.length - 4) {
          return;
        }
      }

      if (!this.template) {
        return super.renderValue(value, container, index);
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.template;

      const templateEl = tempDiv.querySelector('template');

      let fragment;
      if (templateEl) {
        fragment = templateEl.content.cloneNode(true);
      } else {
        fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
      }

      const slot = fragment.querySelector('slot');
      if (slot) {
        const valueNode = document.createTextNode(value.toString());
        slot.parentNode.replaceChild(valueNode, slot);
      } else {
        const node = fragment.firstElementChild;
        if (node) {
          node.textContent = value.toString();
        }
      }

      this._process(fragment);

      container.appendChild(fragment);
    }
  };
}
