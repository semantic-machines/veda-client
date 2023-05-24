import ValueComponent from './ValueComponent.js';

export default function PropertyComponent (Class = HTMLElement) {
  class PropertyComponent extends ValueComponent(Class) {
    template;

    renderValue (value, container) {
      if (!this.template) {
        return super.renderValue(value, container);
      }

      if (typeof value === 'string') {
        const lang = document.documentElement.lang;
        this.setAttribute('lang', lang);
        if (value.indexOf(`^^${lang}`) > 0 || value.indexOf('^^') < 0) {
          value = value.substring(0, value.length - value.indexOf('^^'));
        } else return;
      }

      const template = document.createElement('template');
      template.innerHTML = this.template;
      const fragment = template.content;
      const slot = fragment.querySelector('slot');
      if (slot) {
        const valueNode = document.createTextNode(value.toString());
        slot.parentNode.replaceChild(valueNode, slot);
      } else {
        const node = fragment.firstElementChild;
        node.textContent = value.toString();
      }
      container.appendChild(fragment);
    }
  };

  return PropertyComponent;
}
