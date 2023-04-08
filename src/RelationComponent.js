import Component from './Component.js';
import ValueComponent from './ValueComponent.js';

const hashCode = (s) => Math.abs(s.split('').reduce((a, b) => (a=((a<<5)-a)+b.charCodeAt(0), a&a), 0));
const re_component = /^<([a-z]+-|[^>]+is="[a-z]+-)/;

export default function RelationComponent (Class = HTMLElement) {
  class RelationComponent extends ValueComponent(Class) {
    renderValue (value) {
      if (!this.template) {
        return super.renderValue(value);
      }
      if (re_component.test(this.template)) {
        const template = document.createElement('template');
        template.innerHTML = this.template;
        const fragment = template.content;
        const node = fragment.firstElementChild;
        node.setAttribute('about', value.id);
        this.appendChild(fragment);
        return;
      }
      const template = this.template;
      const hash = hashCode(template);
      const tag = `inline-${hash}`;
      const InlineComponent = customElements.get(tag);
      if (!InlineComponent) {
        class InlineComponent extends Component() {
          render () { return template; }
        }
        customElements.define(tag, InlineComponent);
      }
      const component = document.createElement(tag);
      component.model = value;
      this.appendChild(component);
    }
  };

  Object.defineProperty(RelationComponent, 'name', {value: `RelationComponent(${Class.name})`});

  return RelationComponent;
}
