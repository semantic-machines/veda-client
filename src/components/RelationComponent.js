import ValueComponent from './ValueComponent.js';
import InlineComponent from './InlineComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  class RelationComponent extends ValueComponent(Class) {
    template;

    renderValue (value, container) {
      if (!this.template) {
        return super.renderValue(value, container);
      }
      const is = 'slot-inline-component';
      let Class = customElements.get(is);
      if (!Class) {
        Class = InlineComponent(HTMLSlotElement);
        customElements.define(is, Class, {extends: 'slot'});
      }
      const slot = document.createElement('slot', {is});
      slot.template = this.template;
      slot.model = value;
      container.appendChild(slot);
    }
  };

  return RelationComponent;
}
