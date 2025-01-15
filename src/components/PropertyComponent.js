import ValueComponent from './ValueComponent.js';

export default function PropertyComponent (Class = HTMLElement) {
  return class PropertyComponentClass extends ValueComponent(Class) {
    static observedAttributes = ['lang'];

    attributeChangedCallback (name, oldValue, newValue) {
      if (!oldValue || oldValue === newValue) return;
      super.render();
    }

    renderValue (value, container) {
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
        return super.renderValue(value, container);
      }

      let template = document.createElement('template');
      template.innerHTML = this.template;
      let fragment = template.content;
      const slot = fragment.querySelector('slot');
      if (slot) {
        const valueNode = document.createTextNode(value.toString());
        slot.parentNode.replaceChild(valueNode, slot);
      } else {
        const node = fragment.firstElementChild;
        node.textContent = value.toString();
      }
      container.appendChild(fragment);

      template.remove();
      template = null;
      fragment = null;
    }
  };
}
