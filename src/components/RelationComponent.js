import Component from './Component.js';
import ValueComponent from './ValueComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  class RelationComponent extends ValueComponent(Class) {
    static name = 'RelationComponent';

    #childrenRendered = [];

    async renderValue (value, container) {
      if (!this.template) {
        return super.renderValue(value, container);
      }
      const slot = document.createElement('slot', {is: `${RelationValueComponent}`});

      this.#childrenRendered.push(slot);

      slot.model = value;
      slot.template = this.template;
      await slot.connectedCallback();
      container.append(...slot.childNodes, slot);
      slot.remove();
    }
  };

  return RelationComponent;
}

class RelationValueComponent extends Component(HTMLSlotElement) {
  static tag = 'relation-value-component';
}
customElements.define(RelationValueComponent.tag, RelationValueComponent, {extends: 'slot'});
