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

    async connectedCallback() {
      // Find and cache parent component context
      this._vedaParentContext = this.#findParentComponent();

      // Extract template - Component._process() stores innerHTML in this.template
      this.#template = document.createDocumentFragment();

      if (this.template) {
        const temp = document.createElement('div');
        temp.innerHTML = this.template;

        // Use all children
        while (temp.firstChild) {
          this.#template.appendChild(temp.firstChild);
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
        const itemName = this.getAttribute('as') || 'item';

        if (!itemData) {
          // Create new element with index
          const { element, evalContext } = this.#createItemElement(item, index);
          itemData = { element, item, index, evalContext };
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
      // Clone template
      const fragment = this.#template.cloneNode(true);

      // Get first element child (skip text nodes)
      let element = fragment.firstElementChild;

      if (!element) {
        console.warn('Loop template must contain an element');
        element = document.createElement('div');
        element.appendChild(fragment);
        // Put the wrapper back into fragment so _process can handle it
        fragment.appendChild(element);
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

      // Get item name from 'as' attribute (default: 'item')
      const itemName = this.getAttribute('as') || 'item';

      // Create REACTIVE evaluation context
      // This allows updates to trigger re-renders automatically
      const evalContext = reactive({
        [itemName]: item,
        index: index
      });

      // Set up prototype chain: evalContext -> parent.state -> parent
      // This allows access to:
      // 1. Item data: {todo.text}
      // 2. Index: {index}
      // 3. Parent state: {this.state.filter}
      // 4. Parent methods: {handleClick}
      if (this._vedaParentContext) {
        const parentState = this._vedaParentContext.state;
        if (parentState) {
          Object.setPrototypeOf(evalContext, parentState);
          Object.setPrototypeOf(parentState, this._vedaParentContext);
        } else {
          Object.setPrototypeOf(evalContext, this._vedaParentContext);
        }
      }

      // Process the fragment (not just the element) so walker can see the root element
      this._process(fragment, evalContext);

      // After processing, get the element from fragment (it may have been replaced)
      element = fragment.firstElementChild;

      return { element, evalContext };
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


