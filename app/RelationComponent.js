import ValueComponent from './ValueComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  return class RelationComponent extends ValueComponent(Class) {
    renderValue (value) {
      if (!this.template) {
        return super.renderValue(value);
      }
      const template = document.createElement('template');
      template.innerHTML = this.template;
      const fragment = template.content;
      const node = fragment.firstElementChild;
      node.setAttribute('about', value.id);
      this.appendChild(fragment);
    }
  };
}
