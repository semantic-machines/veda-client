import Component from './Component.js';
import {effect} from '../Effect.js';

export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponentClass extends Component(Class) {
    #propEffect = null;
    #valueNodes = new Map(); // Track rendered value nodes for updates

    added () {
      this.prop = this.getAttribute('property') ?? this.getAttribute('rel');

      // Create effect to track model property changes
      this.#propEffect = effect(() => {
        this.render();
      });
    }

    removed () {
      // Cleanup effect
      if (this.#propEffect) {
        this.#propEffect();
        this.#propEffect = null;
      }
      this.#valueNodes.clear();
    }

    render () {
      const container = this.hasAttribute('shadow')
        ? this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot)
        : this;

      // Get current values
      const values = this.model.hasValue(this.prop)
        ? (Array.isArray(this.model[this.prop]) ? this.model[this.prop] : [this.model[this.prop]])
        : [];

      // For now, simple approach: clear and re-render
      // TODO: Implement reconciliation for better performance
      container.replaceChildren();
      this.#valueNodes.clear();

      values.forEach((value, index) => {
        this.renderValue(value, container, index);
      });
    }

    renderValue (value, container, index) {
      const node = document.createTextNode(value.toString());
      container.appendChild(node);
      this.#valueNodes.set(index, {value, node});
    }
  };
}
