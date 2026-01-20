import Component from './Component.js';
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
    #scrollEffect = null;
    #resizeObserver = null;
    #viewportElement = null;
    #spacerElement = null;
    #contentElement = null;
    #childrenFragment = null;
    #isDisconnected = false;

    constructor() {
      super();
      this.state.scrollTop = 0;
      this.state.measuredHeight = 0;
      this.state._items = []; // Reactive items storage
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

    get virtualStart() {
      const start = Math.floor(this.state.scrollTop / this.itemHeight);
      return Math.max(0, start - this.overscan);
    }

    get virtualEnd() {
      const visibleCount = Math.ceil(this.viewportHeight / this.itemHeight);
      const end = this.virtualStart + visibleCount + this.overscan * 2;
      return Math.min(this.state._items.length, end);
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
        const temp = document.createElement('div');
        temp.innerHTML = this.template;
        while (temp.firstChild) {
          this.#childrenFragment.appendChild(temp.firstChild);
        }
      }

      // Set up items tracking BEFORE building DOM
      const itemsExpr = this.getAttribute('items');
      if (itemsExpr) {
        // Initial load (synchronous)
        this.state._items = this.#evaluateItems(itemsExpr);
      }

      // Build wrapper DOM structure
      this.#buildDOM();

      // Set template on child custom elements before adding to DOM
      // This mimics what Component._process does for custom elements
      this.#prepareChildTemplates(this.#childrenFragment);

      // Add children to DOM - custom elements will initialize via connectedCallback
      this.#contentElement.appendChild(this.#childrenFragment);

      // Call parent connectedCallback (skip render since we built DOM manually)
      this.template = ''; // Prevent Component from re-rendering
      await super.connectedCallback();

      // Set up reactive tracking for items changes
      if (itemsExpr) {
        this.#itemsEffect = effect(() => {
          this.state._items = this.#evaluateItems(itemsExpr);
          this.#updateSpacer();
          this.#checkHeightLimit();
        }, { component: this._vedaParentContext });
      }

      // Set up effect for scroll position changes
      this.#scrollEffect = effect(() => {
        // Access scrollTop to track it reactively
        const scrollTop = this.state.scrollTop;
        if (scrollTop >= 0) {
          this.#updateContentPosition();
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

      if (this.#scrollEffect) {
        this.#scrollEffect();
        this.#scrollEffect = null;
      }

      if (this.#resizeObserver) {
        this.#resizeObserver.disconnect();
        this.#resizeObserver = null;
      }

      this.#viewportElement = null;
      this.#spacerElement = null;
      this.#contentElement = null;
      this.#childrenFragment = null;
      this._vedaParentContext = null;

      super.disconnectedCallback?.();
    }

    // === DOM Building ===

    #buildDOM() {
      const heightStyle = this.getAttribute('height') === 'auto'
        ? 'height: 100%'
        : `height: ${this.viewportHeight}px`;

      // Create viewport
      this.#viewportElement = document.createElement('div');
      this.#viewportElement.className = 'virtual-viewport';
      this.#viewportElement.style.cssText = `${heightStyle}; overflow-y: auto; position: relative;`;
      this.#viewportElement.addEventListener('scroll', (e) => this.handleScroll(e));

      // Create spacer
      this.#spacerElement = document.createElement('div');
      this.#spacerElement.className = 'virtual-spacer';
      this.#spacerElement.style.cssText = `height: ${this.totalHeight}px; position: relative;`;

      // Create content container
      this.#contentElement = document.createElement('div');
      this.#contentElement.className = 'virtual-content';
      this.#contentElement.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; transform: translateY(0px);';

      // Assemble
      this.#spacerElement.appendChild(this.#contentElement);
      this.#viewportElement.appendChild(this.#spacerElement);
      this.appendChild(this.#viewportElement);
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

    #updateContentPosition() {
      if (this.#contentElement) {
        this.#contentElement.style.transform = `translateY(${this.offsetY}px)`;
      }
    }

    // === Event handlers ===

    handleScroll(e) {
      this.state.scrollTop = e.target.scrollTop;
    }

    // === Private methods ===

    #prepareChildTemplates(container) {
      // Find all custom elements and set their template property
      // This mimics what Component._process does
      const customElements = container.querySelectorAll('*');
      for (const el of customElements) {
        if (el.tagName.includes('-')) {
          el.template = el.innerHTML.trim();
        }
      }
    }

    #evaluateItems(expr) {
      try {
        const cleanExpr = expr.trim().replace(/^\{/, '').replace(/\}$/, '');
        const context = this._vedaParentContext;

        if (!context) {
          return [];
        }

        const items = ExpressionParser.evaluate(cleanExpr, context);
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
