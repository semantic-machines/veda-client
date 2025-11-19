import Component from './Component.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';

/**
 * Loop component for rendering reactive lists with reconciliation
 *
 * Usage:
 * <veda-loop items="{this.todos}" item-key="id">
 *   <todo-item></todo-item>
 * </veda-loop>
 *
 * Multiple children will be repeated for each item:
 * <veda-loop items="{this.users}" item-key="id">
 *   <h3>{this.model.name}</h3>
 *   <p>{this.model.email}</p>
 * </veda-loop>
 *
 * Note: <template> wrapper is optional (backward compatibility)
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
      // Find and cache parent component context
      this._vedaParentContext = this.#findParentComponent();

      // Extract template - Component._process() stores innerHTML in this.template
      this.#template = document.createDocumentFragment();

      if (this.template) {
        // Template was saved by parent's _process()
        const temp = document.createElement('div');
        temp.innerHTML = this.template;

        // Check if there's a <template> element (old syntax support)
        const templateEl = temp.querySelector('template');

        if (templateEl) {
          // Old syntax: <Loop><template>...</template></Loop>
          const content = templateEl.content.cloneNode(true);
          this.#template.appendChild(content);
        } else {
          // New syntax: <Loop>...</Loop> - use all children
          while (temp.firstChild) {
            this.#template.appendChild(temp.firstChild);
          }
        }
      }

      // Clear original children - they'll be recreated for each item
      this.replaceChildren();

      // Now call super which will process the component
      await super.connectedCallback();

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
        // If there are multiple children, warn user to wrap them
        if (fragment.children.length > 1) {
          console.warn(
            'Loop component: Multiple root elements detected.',
            'Please wrap them in a single root element (e.g. <div>, <li>, etc.).',
            'Only the first element will be used, others will be ignored.'
          );
          // Use only the first element - don't wrap in div
        }
      }

      // Set model on element
      if (item && typeof item === 'object') {
        element.model = item;
        if ('id' in item && item.id) {
          element.setAttribute('about', item.id);
        }
      }

      // Process the element (for reactive expressions, etc)
      // Pass element as evalContext so {this.model.name} works
      this._process(element, element);

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
  Loop = LoopComponent;
}

export { Loop };


