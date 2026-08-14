import Component from './Component.js';

/**
 * Places children into a target node (default: document.body).
 *
 * <veda-place to="body">
 *   <div class="menu">...</div>
 * </veda-place>
 */
export default function PlaceComponent(Class = HTMLElement) {
  return class PlaceComponentClass extends Component(Class) {
    static tag = 'veda-place';

    #placeholder = null;
    #moved = [];
    #isDisconnected = false;

    async connectedCallback() {
      this.#isDisconnected = false;
      this._vedaParentContext = this._findParentComponent();
      this.#placeholder = document.createComment('veda-place');
      this.parentNode?.insertBefore(this.#placeholder, this);
      this._deferRendered();
      await super.connectedCallback();
      this._resolveDeferred();
    }

    disconnectedCallback() {
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;
      this.#clearMoved();
      this.#placeholder?.remove();
      this.#placeholder = null;
      this._vedaParentContext = null;
      super.disconnectedCallback?.();
    }

    render() {
      return this.template ?? '';
    }

    _processEvalContext() {
      return this._vedaEvalContext || this._vedaParentContext || null;
    }

    pre() {
      this.#clearMoved();
    }

    post() {
      if (this.#isDisconnected) return;
      const target = this.#resolveTarget();
      if (!target) return;
      while (this.firstChild) {
        const node = this.firstChild;
        target.appendChild(node);
        this.#moved.push(node);
      }
    }

    #clearMoved() {
      for (const node of this.#moved) node.remove();
      this.#moved = [];
    }

    #resolveTarget() {
      const to = this.getAttribute('to') || 'body';
      if (to === 'body') return document.body;
      const target = document.querySelector(to);
      if (!target) {
        console.warn(`Place: target '${to}' not found`);
        return null;
      }
      return target;
    }
  };
}

const Place = (() => {
  if (typeof customElements !== 'undefined') {
    const PlaceComponentClass = PlaceComponent(HTMLElement);
    customElements.define(PlaceComponentClass.tag, PlaceComponentClass);
    return PlaceComponentClass;
  }
  return PlaceComponent;
})();

export {Place};
