import Component from './Component.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';

/**
 * Loop component for rendering reactive lists with reconciliation
 *
 * Usage:
 * <veda-loop items="{this.todos}" item-key="id">
 *   <template>
 *     <todo-item></todo-item>
 *   </template>
 * </veda-loop>
 *
 * Or with inline template:
 * <veda-loop items="{this.todos}" item-key="id">
 *   <todo-item></todo-item>
 * </veda-loop>
 */
export default function LoopComponent(Class = HTMLElement) {
  return class LoopComponentClass extends Component(Class) {
    static tag = 'veda-loop';

    #loopEffect = null;
    #itemsMap = new Map(); // key → {element, model}
    #template = null;

    constructor() {
      super();
    }

    async connectedCallback() {
      await super.connectedCallback();

      // Find and cache parent component context
      this._vedaParentContext = this.#findParentComponent();

      if (this.template) {
        const temp = document.createElement('div');
        temp.innerHTML = this.template;

        const templateEl = temp.querySelector('template');
        if (templateEl) {
          this.#template = templateEl.content.cloneNode(true);
        } else {
          this.#template = document.createDocumentFragment();
          while (temp.firstChild) {
            this.#template.appendChild(temp.firstChild);
          }
        }
      } else {
        console.warn('Loop: No template content found');
        this.#template = document.createDocumentFragment();
      }

      const itemsExpr = this.getAttribute('items');
      if (!itemsExpr) {
        console.warn('Loop component requires "items" attribute');
        return;
      }

      this.#loopEffect = effect(() => {
        const items = this.#evaluateItems(itemsExpr);
        this.#reconcile(items);
      });
    }

    disconnectedCallback() {
      if (this.#loopEffect) {
        this.#loopEffect();
        this.#loopEffect = null;
      }
      this.#itemsMap.clear();
      super.disconnectedCallback?.();
    }

    #evaluateItems(expr) {
      try {
        const cleanExpr = expr.replace(/^\{|\}$/g, '').trim();

        // Use cached parent context
        const context = this._vedaParentContext;

        if (!context) {
          console.warn('Loop: Cannot find parent component context');
          return [];
        }

        const items = ExpressionParser.evaluate(cleanExpr, context);
        return Array.isArray(items) ? items : [];
      } catch (error) {
        console.error('Loop: Failed to evaluate items expression:', expr, error);
        return [];
      }
    }

    #reconcile(newItems) {
      const keyAttr = this.getAttribute('item-key') || 'id';
      const newKeys = new Set();
      const newItemsMap = new Map();

      // Build map of new items with duplicate key detection
      newItems.forEach((item, index) => {
        const key = this.#getKey(item, keyAttr, index);

        // Warn about duplicate keys
        if (newItemsMap.has(key)) {
          console.warn(
            `Loop component: Duplicate key "${key}" found.`,
            'Each item in the list must have a unique key.',
            'Current item:', item,
            'Previous item:', newItemsMap.get(key).item
          );
        }

        newKeys.add(key);
        newItemsMap.set(key, {item, index});
      });

      // Remove items that are no longer in the list
      for (const [key, {element}] of this.#itemsMap) {
        if (!newKeys.has(key)) {
          element.remove();
          this.#itemsMap.delete(key);
        }
      }

      // Add or reorder items
      let previousElement = null;

      newItems.forEach((item, index) => {
        const key = this.#getKey(item, keyAttr, index);

        let itemData = this.#itemsMap.get(key);

        if (!itemData) {
          // Create new element
          const element = this.#createItemElement(item);
          itemData = {element, item};
          this.#itemsMap.set(key, itemData);
        } else {
          // Update existing element if item changed
          if (itemData.item !== item) {
            this.#updateItemElement(itemData.element, item);
            itemData.item = item;
          }
        }

        // Reorder if needed
        const {element} = itemData;

        if (previousElement) {
          // Insert after previous
          if (previousElement.nextSibling !== element) {
            previousElement.after(element);
          }
        } else {
          // First element
          if (this.firstChild !== element) {
            this.insertBefore(element, this.firstChild);
          }
        }

        previousElement = element;
      });
    }

    #getKey(item, keyAttr, fallbackIndex) {
      if (typeof item === 'object' && item !== null) {
        const key = item[keyAttr];
        return key !== undefined ? String(key) : `__index_${fallbackIndex}`;
      }
      return `__value_${fallbackIndex}_${item}`;
    }

    #createItemElement(item) {
      // Clone template
      const fragment = this.#template.cloneNode(true);

      // Get first element child (skip text nodes)
      let element = fragment.firstElementChild;

      if (!element) {
        console.warn('Loop template must contain an element');
        element = document.createElement('div');
        element.appendChild(fragment);
      } else {
        // If there are multiple children, wrap them
        if (fragment.children.length > 1) {
          const wrapper = document.createElement('div');
          wrapper.appendChild(fragment);
          element = wrapper;
        }
      }

      // Set model if element is a component
      if (item && typeof item === 'object' && 'id' in item) {
        element.model = item;
        if (item.id) {
          element.setAttribute('about', item.id);
        }
      }

      // Process the element (for reactive expressions, etc)
      this._process(element);

      return element;
    }

    #updateItemElement(element, item) {
      // Update model if element is a component
      if (item && typeof item === 'object' && 'id' in item) {
        element.model = item;
        if (item.id) {
          element.setAttribute('about', item.id);
        }
      }
    }

    #findParentComponent() {
      let context = this.parentElement;
      let depth = 0;
      while (context && depth < 10) {
        const tagName = context.tagName?.toLowerCase();
        const isComponent = tagName?.includes('-') || context.hasAttribute('is');
        const isFrameworkComponent = tagName === 'veda-if' || tagName === 'veda-loop';

        if (isComponent && !isFrameworkComponent) {
          return context;
        }
        context = context.parentElement;
        depth++;
      }
      return null;
    }

    render() {
      // Loop component doesn't use standard render
      // It manages its children through reconciliation
      return '';
    }
  };
}

// Define the component only if running in browser
let Loop;
if (typeof customElements !== 'undefined') {
  const LoopComponentClass = LoopComponent(HTMLElement);
  customElements.define(LoopComponentClass.tag, LoopComponentClass);
  Loop = LoopComponentClass;
} else {
  // Export function for testing in Node.js
  Loop = LoopComponent;
}

export { Loop };


