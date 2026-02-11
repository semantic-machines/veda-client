import Component from './Component.js';
import LoopComponent from './LoopComponent.js';
import IfComponent from './IfComponent.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';

// Browser max element height is ~33,554,432px (2^25) in most browsers
const MAX_BROWSER_HEIGHT = 33554432;

/**
 * Virtual scrolling wrapper component for efficient rendering of large lists.
 * Renders only visible items plus a buffer (overscan) for smooth scrolling.
 *
 * Usage:
 * <veda-virtual items="{this.state.items}" height="400" item-height="40">
 *   <veda-loop items="{this.visibleItems}" key="id" as="item">
 *     <div class="row">{item.name}</div>
 *   </veda-loop>
 * </veda-virtual>
 *
 * Provides to children via parent context:
 * - this.visibleItems: Array of visible items (sliced from source)
 * - this.virtualStart: Index of first visible item
 * - this.virtualEnd: Index of last visible item
 * - this.virtualTotal: Total number of items
 */
export default function VirtualComponent(Class = HTMLElement) {
  return class VirtualComponentClass extends Component(Class) {
    static tag = 'veda-virtual';

    #itemsEffect = null;
    #boundsEffect = null;
    #resizeObserver = null;
    #viewportElement = null;
    #spacerElement = null;
    #contentElement = null;
    #childrenFragment = null;
    #isDisconnected = false;
    #isTableMode = false;
    #tableElement = null;
    #theadEl = null;
    #tfootEl = null;
    #theadHeight = 0;
    #tfootHeight = 0;

    // Non-reactive scroll position — updated every pixel in handleScroll.
    // NOT stored in state to avoid triggering LoopComponent on every pixel.
    #scrollTop = 0;

    // Non-reactive cache for bounds comparison (avoids reading reactive state
    // in #syncVirtualBounds, which would leak dependencies into callers).
    #boundStart = 0;
    #boundEnd = 0;
    #lastOffsetY = -1;
    #lastStickyTop = -1;

    constructor() {
      super();
      this.state.measuredHeight = 0;
      this.state._items = []; // Reactive items storage
      // Reactive virtual window bounds — only change when the visible
      // item range actually shifts, NOT on every scroll pixel.
      this.state._virtualStart = 0;
      this.state._virtualEnd = 0;
    }

    // === Attribute getters ===

    get itemHeight() {
      return parseInt(this.getAttribute('item-height')) || 40;
    }

    get viewportHeight() {
      const attrHeight = this.getAttribute('height');
      if (attrHeight && attrHeight !== 'auto') {
        return parseInt(attrHeight);
      }
      // Fallback to measured height or default
      return this.state.measuredHeight || 400;
    }

    get overscan() {
      return parseInt(this.getAttribute('overscan')) || 3;
    }

    // === Computed properties (available to children via parent context) ===

    // Number of visible rows that fit in the viewport
    get #visibleCount() {
      return Math.ceil(this.viewportHeight / this.itemHeight);
    }

    get virtualStart() {
      return this.state._virtualStart;
    }

    get virtualEnd() {
      return this.state._virtualEnd;
    }

    get visibleItems() {
      return this.state._items.slice(this.virtualStart, this.virtualEnd);
    }

    get virtualTotal() {
      return this.state._items.length;
    }

    get totalHeight() {
      const height = this.state._items.length * this.itemHeight;
      // Clamp to browser max height to prevent rendering issues
      return Math.min(height, MAX_BROWSER_HEIGHT);
    }

    get maxVisibleItems() {
      return Math.floor(MAX_BROWSER_HEIGHT / this.itemHeight);
    }

    get isHeightLimited() {
      return this.state._items.length * this.itemHeight > MAX_BROWSER_HEIGHT;
    }

    get offsetY() {
      return this.virtualStart * this.itemHeight;
    }

    // === Lifecycle ===

    async connectedCallback() {
      this.#isDisconnected = false;
      this._vedaParentContext = this._findParentComponent();

      // Get children from template (set by Component.js before connectedCallback)
      this.#childrenFragment = document.createDocumentFragment();
      if (this.template) {
        // Use <template> element for parsing to correctly handle table fragments
        // (<tr>, <td>, etc.) which would be foster-parented inside a <div>
        const temp = document.createElement('template');
        temp.innerHTML = this.template;
        while (temp.content.firstChild) {
          this.#childrenFragment.appendChild(temp.content.firstChild);
        }
      }

      // Detect table mode: check if first element child is a <table>
      let firstEl = null;
      for (const node of this.#childrenFragment.childNodes) {
        if (node.nodeType === 1) { firstEl = node; break; }
      }
      this.#isTableMode = firstEl?.tagName === 'TABLE';

      // Set up items tracking BEFORE building DOM
      const itemsExpr = this.getAttribute('items');
      if (itemsExpr) {
        // Initial load (synchronous)
        this.state._items = this.#evaluateItems(itemsExpr);
      }

      // Compute initial virtual bounds
      this.#syncVirtualBounds();

      // Build wrapper DOM structure
      this.#buildDOM();

      // Set template on child custom elements before adding to DOM
      // This mimics what Component._process does for custom elements
      if (this.#isTableMode) {
        // In table mode: upgrade semantic elements, then put table into content div.
        // Sticky thead/tfoot are simulated via counter-transforms in #updateStickyHeaders.
        this.#prepareChildTemplates(this.#tableElement);
        this.#contentElement.appendChild(this.#tableElement);

        // Cache thead/tfoot elements and apply styles for sticky simulation
        this.#theadEl = this.#tableElement.querySelector('thead');
        this.#tfootEl = this.#tableElement.querySelector('tfoot');
        if (this.#theadEl) {
          this.#theadEl.style.cssText += '; position: relative; z-index: 2; will-change: transform;';
          this.#theadHeight = this.#theadEl.offsetHeight || this.itemHeight;
        }
        if (this.#tfootEl) {
          this.#tfootEl.style.cssText += '; position: relative; z-index: 2; will-change: transform;';
          this.#tfootHeight = this.#tfootEl.offsetHeight || this.itemHeight;
        }
      } else {
        this.#prepareChildTemplates(this.#childrenFragment);
        // Add children to DOM - custom elements will initialize via connectedCallback
        this.#contentElement.appendChild(this.#childrenFragment);
      }

      // Call parent connectedCallback (skip render since we built DOM manually)
      this.template = ''; // Prevent Component from re-rendering
      await super.connectedCallback();

      // Set up reactive tracking for items changes
      if (itemsExpr) {
        this.#itemsEffect = effect(() => {
          this.state._items = this.#evaluateItems(itemsExpr);
          this.#updateSpacer();
          this.#checkHeightLimit();
          // Recalculate bounds — items count may have changed,
          // clamping virtualStart to the new range.
          this.#syncVirtualBounds();
        }, { component: this._vedaParentContext });
      }

      // Effect for content transform and sticky headers — runs only when
      // bounds change, NOT on every scroll pixel. Ensures correct positioning
      // on initial render and when items change (no scroll event fires).
      this.#boundsEffect = effect(() => {
        const start = this.state._virtualStart;
        const end = this.state._virtualEnd;
        if (start >= 0) {
          this.#updateContentTransform();
          this.#updateStickyHeaders();
        }
      }, { component: this });

      // Set up ResizeObserver for auto height
      this.#setupResizeObserver();
    }

    disconnectedCallback() {
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;

      if (this.#itemsEffect) {
        this.#itemsEffect();
        this.#itemsEffect = null;
      }

      if (this.#boundsEffect) {
        this.#boundsEffect();
        this.#boundsEffect = null;
      }

      if (this.#resizeObserver) {
        this.#resizeObserver.disconnect();
        this.#resizeObserver = null;
      }

      this.#viewportElement = null;
      this.#spacerElement = null;
      this.#contentElement = null;
      this.#childrenFragment = null;
      this.#childEvalContext = null;
      this.#tableElement = null;
      this.#theadEl = null;
      this.#tfootEl = null;
      this.#theadHeight = 0;
      this.#tfootHeight = 0;
      this.#scrollTop = 0;
      this.#boundStart = 0;
      this.#boundEnd = 0;
      this.#lastOffsetY = -1;
      this.#lastStickyTop = -1;
      this._vedaParentContext = null;
      this._vedaEvalContext = null;

      super.disconnectedCallback?.();
    }

    // === DOM Building ===

    #buildDOM() {
      const heightStyle = this.getAttribute('height') === 'auto'
        ? 'height: 100%'
        : `height: ${this.viewportHeight}px`;

      // Create viewport (shared between both modes)
      this.#viewportElement = document.createElement('div');
      this.#viewportElement.className = 'virtual-viewport';
      this.#viewportElement.style.cssText = `${heightStyle}; overflow-y: auto; position: relative;`;
      this.#viewportElement.addEventListener('scroll', (e) => this.handleScroll(e), { passive: true });

      if (this.#isTableMode) {
        this.#buildTableDOM();
      } else {
        this.#buildListDOM();
      }

      this.appendChild(this.#viewportElement);
    }

    #buildListDOM() {
      // Create spacer (full scroll height)
      this.#spacerElement = document.createElement('div');
      this.#spacerElement.className = 'virtual-spacer';
      this.#spacerElement.style.cssText = `height: ${this.totalHeight}px; position: relative;`;

      // Create content container (moves via transform)
      this.#contentElement = document.createElement('div');
      this.#contentElement.className = 'virtual-content';
      this.#contentElement.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; will-change: transform; contain: layout; transform: translateY(0px);';

      // Assemble
      this.#spacerElement.appendChild(this.#contentElement);
      this.#viewportElement.appendChild(this.#spacerElement);
    }

    #buildTableDOM() {
      // Extract the <table> from the fragment
      this.#tableElement = null;
      for (const node of this.#childrenFragment.childNodes) {
        if (node.nodeType === 1 && node.tagName === 'TABLE') {
          this.#tableElement = node;
          break;
        }
      }
      if (!this.#tableElement) return;

      // table-layout:fixed prevents column width recalculation when rows change
      this.#tableElement.style.cssText += '; width: 100%; border-collapse: collapse; table-layout: fixed;';

      // Use same spacer+content div structure as list mode.
      // Transform-based positioning causes zero layout shifts (CLS=0).
      this.#spacerElement = document.createElement('div');
      this.#spacerElement.className = 'virtual-spacer';
      this.#spacerElement.style.cssText = `height: ${this.totalHeight}px; position: relative;`;

      // contain:layout limits the scope of layout recalculations to this subtree
      this.#contentElement = document.createElement('div');
      this.#contentElement.className = 'virtual-content';
      this.#contentElement.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; will-change: transform; contain: layout; transform: translateY(0px);';

      this.#spacerElement.appendChild(this.#contentElement);
      this.#viewportElement.appendChild(this.#spacerElement);
    }

    #updateSpacer() {
      if (this.#spacerElement) {
        this.#spacerElement.style.height = `${this.totalHeight}px`;
      }
    }

    #checkHeightLimit() {
      if (this.isHeightLimited) {
        console.warn(
          `Virtual: List height exceeds browser limit. ` +
          `Only ${this.maxVisibleItems.toLocaleString()} of ${this.state._items.length.toLocaleString()} items are scrollable. ` +
          `Reduce item-height or use pagination for larger datasets.`
        );
      }
    }

    // Recalculate virtual window bounds from current scroll position.
    // Updates reactive state._virtualStart/End ONLY when bounds actually change.
    // Uses non-reactive #boundStart/End for comparison to avoid leaking
    // reactive dependencies into the caller (e.g. itemsEffect).
    #syncVirtualBounds() {
      const scrollRow = Math.floor(this.#scrollTop / this.itemHeight);
      const maxStart = Math.max(0, this.state._items.length - 1);
      const newStart = Math.min(Math.max(0, scrollRow - this.overscan), maxStart);
      const newEnd = Math.min(
        this.state._items.length,
        newStart + this.#visibleCount + this.overscan * 2,
      );

      if (newStart !== this.#boundStart || newEnd !== this.#boundEnd) {
        this.#boundStart = newStart;
        this.#boundEnd = newEnd;
        this.state._virtualStart = newStart;
        this.state._virtualEnd = newEnd;
      }
    }

    // Current offsetY derived from non-reactive #boundStart.
    // Always up-to-date after #syncVirtualBounds, safe to call from
    // both handleScroll (synchronous) and effects (microtask).
    get #currentOffsetY() {
      return this.#boundStart * this.itemHeight;
    }

    // Update content div transform. Called from boundsEffect (atomic with
    // LoopComponent) and from handleScroll (immediate on bounds change).
    #updateContentTransform() {
      if (!this.#contentElement) return;

      const oy = this.#currentOffsetY;
      if (oy !== this.#lastOffsetY) {
        this.#lastOffsetY = oy;
        this.#contentElement.style.transform = `translateY(${oy}px)`;
      }
    }

    // Update thead/tfoot counter-transforms for sticky simulation.
    // Called directly from handleScroll — runs every pixel for smooth headers.
    // Uses #currentOffsetY (from #boundStart) so it's always in sync,
    // even before boundsEffect runs.
    #updateStickyHeaders() {
      if (!this.#isTableMode) return;

      const oy = this.#currentOffsetY;

      if (this.#theadEl) {
        const stickyTop = Math.max(0, this.#scrollTop - oy);
        if (stickyTop !== this.#lastStickyTop) {
          this.#lastStickyTop = stickyTop;
          this.#theadEl.style.transform = `translateY(${stickyTop}px)`;
        }
      }

      if (this.#tfootEl) {
        const bodyH = this.#boundEnd > this.#boundStart
          ? (this.#boundEnd - this.#boundStart) * this.itemHeight
          : 0;
        const naturalBottom = oy + this.#theadHeight + bodyH + this.#tfootHeight;
        const viewportBottom = this.#scrollTop + this.viewportHeight;

        if (naturalBottom > viewportBottom) {
          const offset = (viewportBottom - this.#tfootHeight) - (oy + this.#theadHeight + bodyH);
          this.#tfootEl.style.transform = `translateY(${offset}px)`;
        } else {
          this.#tfootEl.style.transform = '';
        }
      }
    }

    // === Event handlers ===

    handleScroll() {
      if (!this.#viewportElement) return;

      // Round to integer to prevent subpixel boundary oscillation.
      this.#scrollTop = Math.round(this.#viewportElement.scrollTop);

      // Update reactive bounds only when the visible window shifts.
      // This is the ONLY place that triggers LoopComponent re-evaluation.
      this.#syncVirtualBounds();

      // Update content transform and sticky headers synchronously.
      // Both use #boundStart/#boundEnd (always current after #syncVirtualBounds).
      // LoopComponent runs later in microtask, but transform + headers are
      // already correct — all three updates happen before the next paint.
      this.#updateContentTransform();
      this.#updateStickyHeaders();
    }

    // === Private methods ===

    // Create a merged eval context for children:
    // - prototype = parent component (e.g. TestApp) → provides state, methods, etc.
    // - own getters = VirtualComponent computed props → visibleItems, virtualTotal, etc.
    // This allows children to use both {this.visibleItems} and {this.state.userProp}.
    #childEvalContext = null;

    #createChildEvalContext() {
      const parentContext = this._vedaParentContext;
      if (!parentContext) return null;

      const ctx = Object.create(parentContext);
      const self = this;

      const virtualProps = [
        'visibleItems', 'virtualStart', 'virtualEnd', 'virtualTotal',
        'totalHeight', 'maxVisibleItems', 'isHeightLimited', 'offsetY',
        'itemHeight', 'viewportHeight', 'overscan',
      ];

      for (const prop of virtualProps) {
        Object.defineProperty(ctx, prop, {
          get() { return self[prop]; },
          configurable: true,
        });
      }

      return ctx;
    }

    #prepareChildTemplates(container) {
      // Prepare child templates — mimics the relevant parts of Component._process:
      // custom elements (dash in tag), semantic loops (items attr), semantic ifs (condition attr)
      this.#childEvalContext = this.#createChildEvalContext();
      const elements = [...container.querySelectorAll('*')];

      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        const hasDash = tag.includes('-');

        if (!hasDash && el.hasAttribute('items')) {
          this.#upgradeToSemanticComponent(el, tag, 'loop', LoopComponent);
        } else if (!hasDash && el.hasAttribute('condition')) {
          this.#upgradeToSemanticComponent(el, tag, 'if', IfComponent);
        } else if (hasDash) {
          // Create a proper custom element instance via document.createElement
          // (triggers constructor + field initializers). Setting template on an
          // HTML-parsed element from <template> would be overwritten during
          // custom element upgrade when connected to the document.
          const component = document.createElement(tag);
          for (const attr of el.attributes) {
            component.setAttribute(attr.nodeName, attr.nodeValue);
          }
          component.template = el.innerHTML.trim();
          component._vedaEvalContext = this.#childEvalContext;
          if (el.parentNode) {
            el.parentNode.replaceChild(component, el);
          }
        }
      }
    }

    #upgradeToSemanticComponent(el, tag, type, ComponentFactory) {
      const is = `${tag}-${type}-component`;
      if (!customElements.get(is)) {
        customElements.define(is, ComponentFactory(el.constructor), {extends: tag});
      }
      const component = document.createElement(tag, {is});
      component.setAttribute('is', is);
      for (const attr of el.attributes) {
        component.setAttribute(attr.nodeName, attr.nodeValue);
      }
      component.template = el.innerHTML.trim();
      component._vedaEvalContext = this.#childEvalContext;
      el.parentNode.replaceChild(component, el);
    }

    #evaluateItems(expr) {
      try {
        const context = this._vedaParentContext;

        if (!context) {
          return [];
        }

        const cleanExpr = expr.trim().replace(/^\{/, '').replace(/\}$/, '');
        const items = ExpressionParser.evaluateAuto(cleanExpr, context);
        return Array.isArray(items) ? items : [];
      } catch (error) {
        console.error('Virtual: Failed to evaluate items expression:', expr, error);
        return [];
      }
    }

    #setupResizeObserver() {
      const attrHeight = this.getAttribute('height');
      if (attrHeight && attrHeight !== 'auto') {
        return; // Fixed height, no need for observer
      }

      if (!this.#viewportElement) return;

      this.#resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.contentRect.height;
          if (height > 0 && height !== this.state.measuredHeight) {
            this.state.measuredHeight = height;
          }
        }
      });

      this.#resizeObserver.observe(this.#viewportElement);
    }

    // === Render (return undefined to skip Component's replaceChildren) ===

    render() {
      return undefined;
    }
  };
}

// Define the component only if running in browser
const Virtual = (() => {
  if (typeof customElements !== 'undefined') {
    const VirtualComponentClass = VirtualComponent(HTMLElement);
    customElements.define(VirtualComponentClass.tag, VirtualComponentClass);
    return VirtualComponentClass;
  }
  return VirtualComponent;
})();

export { Virtual };
