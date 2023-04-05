import ValueComponent from './ValueComponent.js';

export default function PropertyComponent (Class = HTMLElement) {
  class PropertyComponent extends ValueComponent(Class) {
    renderValue (value) {
      if (!this.template) {
        return super.renderValue(value);
      }
      const template = document.createElement('template');
      template.innerHTML = this.template;
      const fragment = template.content;
      const node = fragment.firstElementChild;
      node.textContent = value.toString();
      this.appendChild(fragment);
    }
  };

  Object.defineProperty(PropertyComponent, 'name', {value: `PropertyComponent(${Class.name})`});

  return PropertyComponent;
}
