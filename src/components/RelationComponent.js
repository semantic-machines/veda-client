import ValueComponent from './ValueComponent.js';
import InlineComponent from './InlineComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  class RelationComponent extends ValueComponent(Class) {

    async renderValue (value, container) {
      if (!this.template) {
        return super.renderValue(value, container);
      }
      const is = 'slot-inline-component';
      let Class = customElements.get(is);
      if (!Class) {
        Class = InlineComponent(HTMLSlotElement);
        customElements.define(is, Class, {extends: 'slot'});
      }
      let slot = document.createElement('slot', {is});
      slot.template = this.template;
      slot.model = value;
      slot.parent = this.parent;
      await slot.connectedCallback();
      container.append(...slot.childNodes);
    }
  };

  return RelationComponent;
}

