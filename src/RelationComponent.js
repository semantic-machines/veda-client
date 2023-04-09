import ValueComponent from './ValueComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  class RelationComponent extends ValueComponent(Class) {
    renderValue (value) {
      const template = document.createElement('template');
      template.innerHTML = this.template;
      const fragment = template.content;
      fragment.childNodes.forEach((node) => {
        if (!node.hasAttribute('about')) node.setAttribute('about', value.id);
      });
      this.process(fragment);
      this.appendChild(fragment);
    }
  };

  Object.defineProperty(RelationComponent, 'name', {value: `RelationComponent(${Class.name})`});

  return RelationComponent;
}
