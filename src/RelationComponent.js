import ValueComponent from './ValueComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  class RelationComponent extends ValueComponent(Class) {
    template;

    renderValue (value, container) {
      if (!this.template) {
        return super.renderValue(value, container);
      }
      const template = document.createElement('template');
      template.innerHTML = this.template;
      const fragment = template.content;
      for (const node of fragment.children) {
        if (!node.hasAttribute('about')) node.setAttribute('about', value.id);
      }
      this.process(fragment, value);
      container.appendChild(fragment);
    }
  };

  Object.defineProperty(RelationComponent, 'name', {value: `RelationComponent(${Class.name})`});

  return RelationComponent;
}
