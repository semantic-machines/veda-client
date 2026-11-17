import Component from './Component.js';
import {toRaw} from '../Reactive.js';

const MAX_TREE_DEPTH = 20;

/**
 * Places children into a target node (default: document.body).
 *
 * <veda-place to="body">
 *   <div class="menu">...</div>
 * </veda-place>
 *
 * Rendered nodes are moved out of the component once. On subsequent updates
 * the same TemplateInstance is patched in place, so focus/state/animations of
 * the placed subtree survive.
 */
export default function PlaceComponent(Class = HTMLElement) {
  return class PlaceComponentClass extends Component(Class) {
    static tag = 'veda-place';

    #placeholder = null;
    #moved = [];
    #target = null;
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
      this.#target = null;
      this.#placeholder?.remove();
      this.#placeholder = null;
      this._vedaParentContext = null;
      super.disconnectedCallback?.();
    }

    render() {
      return this._compiledTemplate ?? this.template ?? '';
    }

    _processEvalContext() {
      return this._vedaEvalContext || this._vedaParentContext || null;
    }

    pre() {
      const evalContext = this._vedaEvalContext || this._vedaParentContext;
      this._vedaRefsTarget = this.#refsOwner(evalContext, this._vedaParentContext);
    }

    post() {
      try {
        if (this.#isDisconnected) return;
        const target = this.#resolveTarget();
        if (!target) return;
        if (this.#target && this.#target !== target) {
          for (const node of this.#moved) target.appendChild(node);
        }
        this.#target = target;
        while (this.firstChild) {
          const node = this.firstChild;
          target.appendChild(node);
          this.#moved.push(node);
        }
      } finally {
        this._vedaRefsTarget = null;
      }
    }

    // The old instance was rendered into moved nodes; drop them before a new
    // instance is mounted into this component.
    _onTemplateInstanceReplaced() {
      this.#clearMoved();
      this.#target = null;
    }

    // A parent update() rebuilds the author's refs. Place forwards refs to the
    // authoring component, so re-register them after the parent reset them.
    _onTemplateValuesChanged() {
      if (!this.isConnected) return;
      const evalContext = this._vedaEvalContext || this._vedaParentContext;
      this._vedaRefsTarget = this.#refsOwner(evalContext, this._vedaParentContext);
      try {
        this._refreshRefs();
      } finally {
        this._vedaRefsTarget = null;
      }
    }

    #refsOwner(evalContext, fallback) {
      let obj = evalContext;
      for (let i = 0; obj && i < MAX_TREE_DEPTH; i++) {
        if (obj.refs && typeof obj.refs === 'object' && !Array.isArray(obj.refs)) {
          return toRaw(obj) || obj;
        }
        obj = Object.getPrototypeOf(obj);
      }
      return fallback;
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
