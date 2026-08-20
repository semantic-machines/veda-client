import Component from './Component.js';

const MAX_TREE_DEPTH = 20;

/**
 * Projects named content from the host component's original template.
 *
 * Host:
 *   <veda-popup>
 *     <button slot="trigger">Open</button>
 *     <div slot="content">Hello</div>
 *   </veda-popup>
 *
 * Popup render():
 *   <veda-slot name="trigger"></veda-slot>
 *   <veda-slot name="content"></veda-slot>
 */
export default function SlotComponent(Class = HTMLElement) {
  return class SlotComponentClass extends Component(Class) {
    static tag = 'veda-slot';

    #host = null;
    #isDisconnected = false;

    async connectedCallback() {
      this.#isDisconnected = false;
      this.#host = this.#host || this.#resolveHost();
      this.replaceChildren();
      this._deferRendered();
      await super.connectedCallback();
      this._resolveDeferred();
    }

    disconnectedCallback() {
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;
      this.#dropChildRefs();
      this.replaceChildren();
      // Keep #host. Place may move this node to another parent and reconnect;
      // the layout host is no longer an ancestor after the move.
      super.disconnectedCallback?.();
    }

    render() {}

    post() {
      if (this.#isDisconnected) return;
      this.#mount();
    }

    #mount() {
      this._cleanupAllEventListeners();
      this.#dropChildRefs();
      this.replaceChildren();
      const host = this.#host;
      if (!host) return;

      const name = this.getAttribute('name') || 'default';
      const tpl = document.createElement('template');
      tpl.innerHTML = host.template || '';

      const fragment = document.createDocumentFragment();
      let hasProjectedContent = false;
      for (const child of [...tpl.content.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (name !== 'default' || !child.nodeValue.trim()) continue;
          fragment.appendChild(child.cloneNode(true));
          hasProjectedContent = true;
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const slotName = child.getAttribute('slot') || 'default';
        if (slotName !== name) continue;
        child.removeAttribute('slot');
        fragment.appendChild(child.cloneNode(true));
        hasProjectedContent = true;
      }

      if (!hasProjectedContent && this.template) {
        tpl.innerHTML = this.template;
        fragment.appendChild(tpl.content.cloneNode(true));
      }

      // Projected content belongs to the host's parent; fallback belongs to the host.
      const evalContext = hasProjectedContent ? host._vedaEvalContext || host : host;
      this._vedaRefsTarget = this.#refsOwner(evalContext, host);
      this._process(fragment, evalContext);
      this._vedaRefsTarget = null;
      this.append(fragment);
    }

    #resolveHost() {
      const fromTree = this._findParentComponent();
      if (fromTree) return fromTree;

      let obj = this._vedaEvalContext || this._vedaParentContext;
      for (let i = 0; obj && i < MAX_TREE_DEPTH; i++) {
        if (typeof obj.template === 'string') return obj;
        obj = Object.getPrototypeOf(obj);
      }
      return null;
    }

    #dropChildRefs() {
      const host = this.#host;
      if (!host) return;
      const evalContext = host._vedaEvalContext || host;
      const owner = this._vedaRefsTarget || this.#refsOwner(evalContext, host);
      if (!owner?.refs) return;
      for (const [name, node] of Object.entries(owner.refs)) {
        if (node && this.contains(node)) delete owner.refs[name];
      }
    }

    #refsOwner(evalContext, fallback) {
      let obj = evalContext;
      for (let i = 0; obj && i < MAX_TREE_DEPTH; i++) {
        if (obj.refs && typeof obj.refs === 'object' && !Array.isArray(obj.refs)) return obj;
        obj = Object.getPrototypeOf(obj);
      }
      return fallback;
    }
  };
}

const Slot = (() => {
  if (typeof customElements !== 'undefined') {
    const SlotComponentClass = SlotComponent(HTMLElement);
    customElements.define(SlotComponentClass.tag, SlotComponentClass);
    return SlotComponentClass;
  }
  return SlotComponent;
})();

export {Slot};
