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
      this.#host = this._findParentComponent();
      this.replaceChildren();
      this._deferRendered();
      await super.connectedCallback();
      this._resolveDeferred();
    }

    disconnectedCallback() {
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;
      this.replaceChildren();
      this.#host = null;
      super.disconnectedCallback?.();
    }

    render() {}

    post() {
      if (this.#isDisconnected) return;
      this.#mount();
    }

    #mount() {
      this.replaceChildren();
      const host = this.#host;
      if (!host?.template) return;

      const name = this.getAttribute('name') || 'default';
      const tpl = document.createElement('template');
      tpl.innerHTML = host.template;

      const fragment = document.createDocumentFragment();
      for (const child of [...tpl.content.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          if (name !== 'default' || !child.nodeValue.trim()) continue;
          fragment.appendChild(child.cloneNode(true));
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const slotName = child.getAttribute('slot') || 'default';
        if (slotName !== name) continue;
        child.removeAttribute('slot');
        fragment.appendChild(child.cloneNode(true));
      }

      // Slot content is authored by the host's parent, not by the host or the slot.
      const evalContext = host._vedaEvalContext || host;
      this._vedaRefsTarget = this.#refsOwner(evalContext, host);
      this._process(fragment, evalContext);
      this._vedaRefsTarget = null;
      this.append(fragment);
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
