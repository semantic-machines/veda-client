import Component from './Component.js';
import {effect} from '../Effect.js';

export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponentClass extends Component(Class) {
    #propEffect = null;
    #valueEntries = [];
    #isFirstEffectRun = true;
    #initialized = false;
    #force = false;

  added () {
    this._vedaParentContext = this._findParentComponent();
    this.prop = this.getAttribute('property') ?? this.getAttribute('rel');

    if (!this.#propEffect) {
      this.#propEffect = effect(() => {
        // Read dependency for tracking (intentional - triggers reactivity)
        this.state.model?.[this.prop];

        // Skip render() on first effect run - initial render is done by connectedCallback
        if (this.#isFirstEffectRun) {
          this.#isFirstEffectRun = false;
          return;
        }

        // Only re-render if component is still connected to DOM
        if (this.isConnected) {
          this.render();
        }
      }, { component: this._vedaParentContext, internal: true });
    }
  }

  removed () {
    if (this.#propEffect) {
      this.#propEffect();
      this.#propEffect = null;
    }
    this.#clearValues();
  }

  // Force re-rendering of every value, e.g. when the lang attribute changes
  // and the same literal may now be displayed differently.
  _invalidateValueCache () {
    this.#force = true;
  }

  render () {
    const container = this.hasAttribute('shadow')
      ? this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot)
      : this;

    const modelValue = this.state.model[this.prop];
    const values = this.state.model.hasValue(this.prop)
      ? (Array.isArray(modelValue) ? modelValue : [modelValue])
      : [];

    if (!this.#initialized) {
      this.#initialized = true;
      this.#clearValues();
      container.replaceChildren();
    }

    if (this.#force || values.length !== this.#valueEntries.length) {
      this.#force = false;
      this.#clearValues();
      container.replaceChildren();
      values.forEach((value, index) => this.#appendValue(value, container, index));
      return;
    }

    for (let index = 0; index < values.length; index++) {
      const previous = this.#valueEntries[index];
      if (previous && previous.value === values[index]) continue;

      const fragment = document.createDocumentFragment();
      const result = this.renderValue(values[index], fragment, index);
      const {cleanup, instance} = this.#normalizeResult(result);
      const nodes = Array.from(fragment.childNodes);

      previous?.cleanup?.();
      for (const node of previous?.nodes || []) node.remove();

      const next = this.#valueEntries[index + 1];
      const before = next?.nodes[0] || null;
      for (const node of nodes) {
        if (before) container.insertBefore(node, before);
        else container.appendChild(node);
      }

      if (instance) this._addChildrenRendered(instance.childrenRendered);
      this.#valueEntries[index] = {
        value: values[index],
        nodes,
        cleanup,
        instance,
      };
    }
  }

    renderValue (value, container) {
      // Sanitize to prevent XSS via {expr} patterns in data
      const sanitized = value.toString().replace(/!\{/g, '!\u200B{');
      container.appendChild(document.createTextNode(sanitized));
      return null;
    }

    #appendValue (value, container, index) {
      const fragment = document.createDocumentFragment();
      const result = this.renderValue(value, fragment, index);
      const {cleanup, instance} = this.#normalizeResult(result);
      const nodes = Array.from(fragment.childNodes);

      for (const node of nodes) container.appendChild(node);
      if (instance) this._addChildrenRendered(instance.childrenRendered);
      this.#valueEntries.push({
        value,
        nodes,
        cleanup,
        instance,
      });
    }

    #normalizeResult (result) {
      if (typeof result === 'function') return {cleanup: result, instance: null};
      if (result && typeof result === 'object') {
        return {
          cleanup: typeof result.cleanup === 'function' ? result.cleanup : null,
          instance: result.instance || null,
        };
      }
      return {cleanup: null, instance: null};
    }

    _getEventListenersCount () {
      let count = super._getEventListenersCount();
      for (const entry of this.#valueEntries) {
        count += entry.instance?.getEventListenersCount?.() || 0;
      }
      return count;
    }

    _onTemplateValuesChanged (values) {
      for (const entry of this.#valueEntries) {
        entry.instance?.setValues(values);
      }
    }

    #clearValues () {
      for (const entry of this.#valueEntries) {
        entry.cleanup?.();
        for (const node of entry.nodes) node.remove();
      }
      this.#valueEntries = [];
    }
  };
}
