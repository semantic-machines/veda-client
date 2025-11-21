import Component from './Component.js';
import {effect} from '../Effect.js';

export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponentClass extends Component(Class) {
    #propEffect = null;
    #valueNodes = new Map();

  added () {
    this.prop = this.getAttribute('property') ?? this.getAttribute('rel');

    if (!this.#propEffect) {
      this.#propEffect = effect(() => {
        this.render();
      });
    }
  }

  removed () {
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

    const values = this.state.model.hasValue(this.prop)
      ? (Array.isArray(this.state.model[this.prop]) ? this.state.model[this.prop] : [this.state.model[this.prop]])
      : [];

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
