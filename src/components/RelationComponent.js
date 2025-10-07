import Component from './Component.js';
import ValueComponent from './ValueComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  return class RelationComponentClass extends ValueComponent(Class) {
    #childrenRendered = [];

    async renderValue (value, container) {
      if (!this.template) {
        return super.renderValue(value, container);
      }
      const slot = document.createElement('slot', {is: RelationValueComponent.tag});
      slot.setAttribute('is', RelationValueComponent.tag); // Explicitly set 'is' attribute for findMethod

      this.#childrenRendered.push(slot);

      slot.model = value;
      slot.template = this.template;
      // ВАЖНО: Установить ссылку на slot ДО connectedCallback
      // Иначе его дети будут ссылаться на slot без ссылки на родителя
      slot._parentComponentForMethodLookup = this;
      await slot.connectedCallback();

      // Extract children from slot and set parent reference only on top-level elements
      // Nested components will have their own _parentComponentForMethodLookup set during their creation
      const children = [...slot.childNodes];
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          // Only set if not already set (by component creation in #process)
          if (!child._parentComponentForMethodLookup) {
            child._parentComponentForMethodLookup = this;
          }
        }
      }

      container.append(...children);
      slot.remove(); // Remove slot to maintain valid HTML structure and CSS selectors
    }
  };
}

class RelationValueComponent extends Component(HTMLSlotElement) {
  static tag = 'relation-value-component';
}
customElements.define(RelationValueComponent.tag, RelationValueComponent, {extends: 'slot'});
