import Component from './Component.js';
import {effect} from '../Effect.js';

export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponentClass extends Component(Class) {
    #propEffect = null;
    #valueNodes = new Map();
    #isFirstEffectRun = true;

  added () {
    this._vedaParentContext = this._findParentComponent();
    this.prop = this.getAttribute('property') ?? this.getAttribute('rel');

    if (!this.#propEffect) {
      this.#propEffect = effect(() => {
        // Read dependency for tracking (intentional - triggers reactivity)
        this.state.model?.[this.prop]; // eslint-disable-line no-unused-expressions

        // Skip render() on first effect run - initial render is done by connectedCallback
        if (this.#isFirstEffectRun) {
          this.#isFirstEffectRun = false;
          return;
        }

        // Only re-render if component is still connected to DOM
        if (this.isConnected) {
          this.render();
        }
      }, { component: this._vedaParentContext });
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

    const modelValue = this.state.model[this.prop];
    const values = this.state.model.hasValue(this.prop)
      ? (Array.isArray(modelValue) ? modelValue : [modelValue])
      : [];

    container.replaceChildren();
    this.#valueNodes.clear();

    values.forEach((value, index) => {
      this.renderValue(value, container, index);
    });
  }

    renderValue (value, container, index) {
      // Sanitize to prevent XSS via !{ } in data
      const sanitized = value.toString().replace(/!\{/g, '!\u200B{');
      const node = document.createTextNode(sanitized);
      node.__vedaProcessed = true; // Mark as processed to skip re-parsing
      container.appendChild(node);
      this.#valueNodes.set(index, {value, node});
    }
  };
}
