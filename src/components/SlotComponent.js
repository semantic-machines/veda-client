import Component from './Component.js';
import {toRaw} from '../Reactive.js';
import {CompiledTemplate, compileTemplate} from '../template/Template.js';
import {ELEMENT_MARKER} from '../template/markers.js';

/**
 * Resolve the `slot` attribute of a top-level projected element.
 *
 * A static slot name is still present in the compiled template. A `${}` name
 * became an AttributePart, so its value is evaluated from the part segments
 * (static text and `${}` values only; `{expr}` in a slot name is unsupported).
 */
function slotNameOf(element, compiled, values) {
  const marker = element.getAttribute(ELEMENT_MARKER);
  const group = marker
    ? compiled.elements.find(entry => String(entry.id) === marker)
    : null;
  const part = group?.parts.find(entry => entry.type === 'attribute' && entry.name === 'slot');
  if (!part) return element.getAttribute('slot') || 'default';

  let text = '';
  for (const segment of part.segments) {
    if (segment.type === 'static') {
      text += segment.value;
    } else if (segment.type === 'value') {
      const value = values?.[segment.index];
      text += value == null ? '' : String(value);
    } else {
      return null;
    }
  }
  return text;
}

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
 *
 * Forward an outer slot into an inner one by projecting the outlet itself:
 *   <ui-card><veda-slot name="page-aside" slot="aside"></veda-slot></ui-card>
 */
export default function SlotComponent(Class = HTMLElement) {
  return class SlotComponentClass extends Component(Class) {
    static tag = 'veda-slot';

    #host = null;
    #registeredHost = null;
    #isDisconnected = false;
    #instance = null;
    #instanceKey = null;
    #instanceContext = null;

    async connectedCallback() {
      this.#isDisconnected = false;
      this.#host = this.#host || this.#resolveHost();
      this.#instance = null;
      this.#instanceKey = null;
      this.#instanceContext = null;
      this.replaceChildren();
      this._deferRendered();
      await super.connectedCallback();
      this._resolveDeferred();
    }

    disconnectedCallback() {
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;
      this.#stopListeningHost();
      this.#instance?.destroy();
      this.#instance = null;
      this.#instanceKey = null;
      this.#instanceContext = null;
      this.replaceChildren();
      // Keep #host. Place may move this node to another parent and reconnect;
      // the layout host is no longer an ancestor after the move.
      super.disconnectedCallback?.();
    }

    _processEvalContext() {
      return null;
    }

    _getEventListenersCount() {
      return super._getEventListenersCount() + (this.#instance?.getEventListenersCount?.() || 0);
    }

    _onTemplateValuesChanged() {
      if (this.isConnected) this.#mount();
    }

    // The layout host is a component, not an instance of this Slot: when its
    // parent updates the host values, the Slot still has to patch the projected
    // content. The host keeps its slots in a Set and calls this method.
    _onHostValuesChanged() {
      if (this.isConnected) this.#mount();
    }

    render() {}

    post() {
      this.#mount();
    }

    #mount() {
      if (this.#isDisconnected) return;

      const host = this.#host;
      if (!host) {
        this.#stopListeningHost();
        this.replaceChildren();
        return;
      }
      this.#listenToHost(host);

      const name = this.getAttribute('name') || 'default';
      const projection = this.#buildProjection(host, name);
      const evalContext = projection.hasProjected
        ? host._vedaEvalContext || host
        : host;
      // Projected content belongs to the parent template, so its `${}` values
      // are the host values. The Slot fallback belongs to this layout.
      const values = projection.hasProjected
        ? (host._templateValues || [])
        : (this._templateValues || []);
      const key = `${projection.hasProjected ? 'p' : 'f'}|${name}|${projection.key}`;

      if (
        this.#instance &&
        this.#instanceKey === key &&
        this.#instanceContext === evalContext
      ) {
        this._vedaRefsTarget = this.#refsOwner(evalContext, host);
        try {
          this.#instance.setValues(values);
          this.#instance.refreshRefs();
        } finally {
          this._vedaRefsTarget = null;
        }
        return;
      }

      this.#instance?.destroy();
      this.#instance = null;
      this.replaceChildren();

      this._vedaRefsTarget = this.#refsOwner(evalContext, host);
      try {
        const compiled = projection.compiled || compileTemplate(projection.markup || '');
        const instance = compiled.instantiate(
          evalContext,
          this,
          {values},
        );
        if (projection.hasProjected) this.#pinProjectedSlots(instance.fragment, evalContext);
        this.append(instance.fragment);
        this.#instance = instance;
        this.#instanceKey = key;
        this.#instanceContext = evalContext;
      } finally {
        this._vedaRefsTarget = null;
      }
    }

    // The layout host is a component. It keeps a Set of the slots that project
    // its author content and notifies them when its `${}` values change.
    #listenToHost(host) {
      if (this.#registeredHost === host) return;
      this.#stopListeningHost();
      if (!host) return;
      if (!host._vedaSlotListeners) host._vedaSlotListeners = new Set();
      host._vedaSlotListeners.add(this);
      this.#registeredHost = host;
    }

    #stopListeningHost() {
      const host = this.#registeredHost;
      if (!host) return;
      host._vedaSlotListeners?.delete(this);
      this.#registeredHost = null;
    }

    #buildProjection(host, name) {
      // Author content is already compiled by the parent template. Project a
      // pruned clone of that compiled tree instead of re-parsing strings: the
      // Parts and markers stay intact, `${}` stays a value, and no innerHTML
      // sink is involved.
      const values = host._templateValues || [];
      const hostCompiled = host._compiledTemplate;

      if (hostCompiled) {
        const template = document.createElement('template');
        template.content.appendChild(hostCompiled.template.content.cloneNode(true));

        const original = [...template.content.childNodes];
        const kept = [];
        for (const child of original) {
          if (child.nodeType === Node.TEXT_NODE) {
            if (name !== 'default' || !child.nodeValue.trim()) continue;
            kept.push(child);
            continue;
          }
          if (child.nodeType !== Node.ELEMENT_NODE) continue;
          // Slot names may be static or `${}` values; either way they are only
          // used for matching and dropped from the projection.
          const slotName = slotNameOf(child, hostCompiled, values);
          if (slotName === null || slotName !== name) continue;
          child.removeAttribute('slot');
          kept.push(child);
        }

        if (kept.length) {
          const keep = new Set(kept);
          for (const child of original) {
            if (!keep.has(child)) child.remove();
          }

          const compiled = new CompiledTemplate(template, {
            source: hostCompiled.source,
            type: hostCompiled.type,
            modes: hostCompiled.modes,
          });
          // The pruned template keeps the markers of the kept subtree, so the
          // original descriptors resolve against it; descriptors for removed
          // nodes are skipped by TemplateInstance.
          compiled.elements = hostCompiled.elements;
          compiled.childParts = hostCompiled.childParts;

          const signature = kept.map(child => original.indexOf(child)).join(',');
          return {compiled, hasProjected: true, key: `p|${signature}`};
        }
      }

      if (this._compiledTemplate || this.template) {
        return {
          compiled: this._compiledTemplate || null,
          markup: this.template || '',
          key: this._compiledTemplate ? 'compiled' : this.template,
          hasProjected: false,
        };
      }

      return {compiled: null, markup: '', key: '', hasProjected: false};
    }

    // A forwarded outlet is cloned into the inner component, so its DOM parent
    // is the wrong host. Pin the component that authored the projected template.
    #pinProjectedSlots(fragment, evalContext) {
      const author = this.#authorFromContext(evalContext);
      if (!author) return;
      for (const slot of fragment.querySelectorAll('veda-slot')) {
        slot._vedaSlotHost = author;
      }
    }

    #authorFromContext(context) {
      let obj = context;
      for (let i = 0; obj && i < MAX_TREE_DEPTH; i++) {
        const raw = toRaw(obj) || obj;
        // State objects prototype-chain to their component, so instanceof
        // matches the proxy too. Only the component owns `template`.
        const ownsSource = Object.prototype.hasOwnProperty.call(raw, '_templateSource');
        if (
          raw instanceof Element
          && (ownsSource
            || (Object.prototype.hasOwnProperty.call(raw, 'template')
              && typeof raw.template === 'string'))
        ) return raw;
        obj = Object.getPrototypeOf(raw);
        if (obj === Object.prototype) break;
      }
      return null;
    }

    #resolveHost() {
      if (this._vedaSlotHost) return this._vedaSlotHost;

      const fromTree = this._findParentComponent();
      if (fromTree) return fromTree;

      let obj = this._vedaEvalContext || this._vedaParentContext;
      for (let i = 0; obj && i < MAX_TREE_DEPTH; i++) {
        if (typeof obj.template === 'string'
          || Object.prototype.hasOwnProperty.call(obj, '_templateSource')) return obj;
        obj = Object.getPrototypeOf(obj);
      }
      return null;
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
