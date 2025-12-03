import Component from './Component.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';
import {reactive} from '../Reactive.js';

/**
 * Loop component for rendering reactive lists with reconciliation
 *
 * Usage (v3.0):
 * <veda-loop items="{this.state.todos}" as="todo" key="id">
 *   <todo-item :todo="{todo}" :index="{index}"></todo-item>
 * </veda-loop>
 *
 * Semantic HTML syntax:
 * <ul items="{this.state.todos}" as="todo" key="id">
 *   <li>{index}. {todo.text}</li>
 * </ul>
 */
export default function LoopComponent(Class = HTMLElement) {
  return class LoopComponentClass extends Component(Class) {
    static tag = 'veda-loop';

    #loopEffect = null;
    #itemsMap = new Map(); // key → {element, item, index, evalContext}
    #template = null;
    #isDisconnected = false;  // Prevent double disconnectedCallback

    async connectedCallback() {
      this.#isDisconnected = false;  // Reset on reconnect
      this._vedaParentContext = this._findParentComponent();

      // Extract and store template
      this.#template = document.createDocumentFragment();
      if (this.template) {
        const temp = document.createElement('div');
        temp.innerHTML = this.template;
        while (temp.firstChild) {
          this.#template.appendChild(temp.firstChild);
        }
        temp.innerHTML = ''; // Clear temp to help GC
      }

      this.replaceChildren();
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
      // Prevent double disconnectedCallback calls
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;

      if (this.#loopEffect) {
        this.#loopEffect();
        this.#loopEffect = null;
      }
      // Cleanup all item effects and release references
      const itemName = this.getAttribute('as') || 'item';
      for (const [, itemData] of this.#itemsMap) {
        if (itemData.effects) {
          itemData.effects.forEach(cleanup => cleanup());
          itemData.effects = null;
        }
        if (itemData.evalContext) {
          itemData.evalContext[itemName] = null;
          itemData.evalContext.index = null;
          itemData.evalContext = null;
        }
        itemData.element = null;
        itemData.item = null;
      }
      this.#itemsMap.clear();
      this.#template = null;
      this._vedaParentContext = null;
      super.disconnectedCallback?.();
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
        console.error('Loop: Failed to evaluate items expression:', expr, error);
        return [];
      }
    }

    #reconcile(newItems) {
      // Support both 'key' (new) and 'item-key' (backward compatibility)
      const keyAttr = this.getAttribute('key') || this.getAttribute('item-key') || 'id';
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
      for (const [key, itemData] of this.#itemsMap) {
        if (!newKeys.has(key)) {
          // Cleanup effects created by Loop for this item
          if (itemData.effects) {
            itemData.effects.forEach(cleanup => cleanup());
            itemData.effects = null;
          }
          // Clear evalContext to release model reference
          if (itemData.evalContext) {
            const itemName = this.getAttribute('as') || 'item';
            itemData.evalContext[itemName] = null;
            itemData.evalContext.index = null;
            itemData.evalContext = null;
          }
          // Remove element - browser will call disconnectedCallback for custom elements
          if (itemData.element) {
            itemData.element.remove();
          }
          itemData.element = null;
          itemData.item = null;
          this.#itemsMap.delete(key);
        }
      }

      // Add or reorder items
      let previousElement = null;

      newItems.forEach((item, index) => {
        const key = this.#getKey(item, keyAttr, index);

        let itemData = this.#itemsMap.get(key);
        const itemName = this.getAttribute('as') || 'item';

        if (!itemData) {
          // Create new element with index
          const { element, evalContext, effects } = this.#createItemElement(item, index);
          itemData = { element, item, index, evalContext, effects };
          this.#itemsMap.set(key, itemData);
        } else {
          // Update existing element if item or index changed
          if (itemData.item !== item || itemData.index !== index) {
            // Update the evalContext in-place
            // This will trigger reactive updates automatically
            itemData.evalContext[itemName] = item;
            itemData.evalContext.index = index;
            itemData.item = item;
            itemData.index = index;
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

    #createItemElement(item, index) {
      const fragment = this.#template.cloneNode(true);
      let element = fragment.firstElementChild;

      if (!element) {
        console.warn('Loop template must contain an element');
        element = document.createElement('div');
        element.appendChild(fragment);
        fragment.appendChild(element);
      } else if (fragment.children.length > 1) {
        console.warn(
          'Loop component: Multiple root elements detected.',
          'Please wrap them in a single root element (e.g. <div>, <li>, etc.).',
          'Only the first element will be used, others will be ignored.'
        );
      }

      const itemName = this.getAttribute('as') || 'item';
      const evalContext = reactive({ [itemName]: item, index });

      // Set up prototype chain: evalContext -> parent.state -> parent
      if (this._vedaParentContext) {
        const parentState = this._vedaParentContext.state;
        Object.setPrototypeOf(evalContext, parentState || this._vedaParentContext);
        if (parentState) {
          Object.setPrototypeOf(parentState, this._vedaParentContext);
        }
      }

      // Capture effects created during _process for this specific element
      const effectsStartIndex = this._getRenderEffectsCount();
      this._process(fragment, evalContext);
      const itemEffects = this._extractRenderEffects(effectsStartIndex);

      element = fragment.firstElementChild;

      return { element, evalContext, effects: itemEffects };
    }

    render() {
      return '';
    }
  };
}

// Define the component only if running in browser
const Loop = (() => {
  if (typeof customElements !== 'undefined') {
    const LoopComponentClass = LoopComponent(HTMLElement);
    customElements.define(LoopComponentClass.tag, LoopComponentClass);
    return LoopComponentClass;
  }
  return LoopComponent;
})();

export { Loop };


