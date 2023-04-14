import ValueComponent from './ValueComponent.js';

export default function PropertyComponent (Class = HTMLElement) {
  class PropertyComponent extends ValueComponent(Class) {
    template;

    renderValue (value, container) {
      if (!this.template) {
        return super.renderValue(value, container);
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
