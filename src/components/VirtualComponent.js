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
    #scrollEffect = null;
    #resizeObserver = null;
    #viewportElement = null;
    #spacerElement = null;
    #contentElement = null;
    #childrenFragment = null;
    #isDisconnected = false;
    #isTableMode = false;
    #tableElement = null;
    #spacerTopBody = null;
    #spacerBottomBody = null;

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

      // Build wrapper DOM structure
      this.#buildDOM();

      // Set template on child custom elements before adding to DOM
      // This mimics what Component._process does for custom elements
      if (this.#isTableMode) {
        // In table mode: first upgrade semantic elements (tbody[items] → Loop component),
        // then insert spacer tbodies around the upgraded content tbody, then append to DOM.
        this.#prepareChildTemplates(this.#tableElement);
        this.#insertTableSpacers();
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
      this.#childEvalContext = null;
      this.#tableElement = null;
      this.#spacerTopBody = null;
      this.#spacerBottomBody = null;
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
      this.#viewportElement.addEventListener('scroll', (e) => this.handleScroll(e));

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
      this.#contentElement.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; transform: translateY(0px);';

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

      // Apply sticky positioning to thead and tfoot
      const thead = this.#tableElement.querySelector('thead');
      if (thead) {
        thead.style.cssText += '; position: sticky; top: 0; z-index: 1;';
      }
      const tfoot = this.#tableElement.querySelector('tfoot');
      if (tfoot) {
        tfoot.style.cssText += '; position: sticky; bottom: 0; z-index: 1;';
      }

      // Table width should fill the viewport
      this.#tableElement.style.cssText += '; width: 100%; border-collapse: collapse;';

      // Set contentElement to table for prepareChildTemplates
      this.#contentElement = this.#tableElement;
    }

    // Insert spacer tbodies around the content tbody.
    // Must be called AFTER #prepareChildTemplates, because the semantic upgrade
    // replaces the original <tbody items="..."> with a new component element.
    #insertTableSpacers() {
      if (!this.#tableElement) return;

      // Find the content tbody: look for the upgraded semantic Loop tbody
      // (has 'is' attribute ending with '-loop-component') or any tbody
      const contentBody = this.#tableElement.querySelector('tbody[is]')
                       || this.#tableElement.querySelector('tbody');
      if (!contentBody) return;

      // Create spacer tbodies with display:block to keep them out of table
      // column layout. Empty block elements with explicit height act as spacers
      // without interfering with column widths defined by thead/content rows.
      this.#spacerTopBody = document.createElement('tbody');
      this.#spacerTopBody.className = 'virtual-spacer-top';
      this.#spacerTopBody.style.cssText = `display: block; height: ${this.offsetY}px; padding: 0; border: 0;`;

      this.#spacerBottomBody = document.createElement('tbody');
      this.#spacerBottomBody.className = 'virtual-spacer-bottom';
      const bottomHeight = this.totalHeight - this.offsetY;
      this.#spacerBottomBody.style.cssText = `display: block; height: ${Math.max(0, bottomHeight)}px; padding: 0; border: 0;`;

      // Insert spacers around the content tbody
      contentBody.parentNode.insertBefore(this.#spacerTopBody, contentBody);
      if (contentBody.nextSibling) {
        contentBody.parentNode.insertBefore(this.#spacerBottomBody, contentBody.nextSibling);
      } else {
        contentBody.parentNode.appendChild(this.#spacerBottomBody);
      }

      // Move tfoot after spacer-bottom (must be last for sticky bottom)
      const tfoot = this.#tableElement.querySelector('tfoot');
      if (tfoot) {
        this.#tableElement.appendChild(tfoot);
      }

      // Append table to viewport (now fully assembled)
      this.#viewportElement.appendChild(this.#tableElement);
    }

    #updateSpacer() {
      if (this.#isTableMode) {
        // In table mode, total height is distributed via spacer tbodies
        this.#updateContentPosition();
      } else if (this.#spacerElement) {
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
      if (this.#isTableMode) {
        // Update spacer tbody heights to position visible rows correctly
        if (this.#spacerTopBody) {
          this.#spacerTopBody.style.height = `${this.offsetY}px`;
        }
        if (this.#spacerBottomBody) {
          const visibleHeight = (this.virtualEnd - this.virtualStart) * this.itemHeight;
          const bottomHeight = this.totalHeight - this.offsetY - visibleHeight;
          this.#spacerBottomBody.style.height = `${Math.max(0, bottomHeight)}px`;
        }
      } else if (this.#contentElement) {
        this.#contentElement.style.transform = `translateY(${this.offsetY}px)`;
      }
    }

    // === Event handlers ===

    handleScroll(e) {
      this.state.scrollTop = e.target.scrollTop;
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
