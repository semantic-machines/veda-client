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
        // Use <template> element for parsing to correctly handle table fragments
        // (<tr>, <td>, etc.) which would be foster-parented inside a <div>
        const temp = document.createElement('template');
        temp.innerHTML = this.template;
        while (temp.content.firstChild) {
          this.#template.appendChild(temp.content.firstChild);
        }
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
      }, { component: this._vedaParentContext });
    }

    disconnectedCallback() {
      // Prevent double disconnectedCallback calls
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;

      if (this.#loopEffect) {
        this.#loopEffect();
        this.#loopEffect = null;
      }
      // Cleanup all item effects and release references.
      // Don't set reactive properties to null (e.g. evalContext[itemName] = null)
      // because that triggers reactive updates in child components (like IfComponent)
      // whose effects haven't been cleaned up yet, causing spurious errors.
      for (const [, itemData] of this.#itemsMap) {
        if (itemData.effects) {
          itemData.effects.forEach(cleanup => cleanup());
          itemData.effects = null;
        }
        itemData.evalContext = null;
        itemData.element = null;
        itemData.item = null;
      }
      this.#itemsMap.clear();
      this.#template = null;
      this._vedaParentContext = null;
      this._vedaEvalContext = null;
      super.disconnectedCallback?.();
    }

    #evaluateItems(expr) {
      try {
        // Prefer inherited eval context (e.g. from outer Loop) over parent component.
        // Enables nested loops: inner loop can access outer loop variables.
        const context = this._vedaEvalContext || this._vedaParentContext;

        if (!context) {
          return [];
        }

        // Check for unsafe expression !{ }
        const unsafeMatch = expr.trim().match(/^!\{(.+)\}$/);
        if (unsafeMatch) {
          const items = ExpressionParser.evaluateUnsafe(unsafeMatch[1].trim(), context);
          return Array.isArray(items) ? items : [];
        }

        // Safe expression { }
        const cleanExpr = expr.trim().replace(/^\{/, '').replace(/\}$/, '');
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
          // Remove element first — triggers disconnectedCallback for child custom
          // elements (e.g. IfComponent), which clean up their own effects before
          // we release the evalContext reference.
          if (itemData.element) {
            itemData.element.remove();
          }
          // Cleanup effects created by Loop's _process for this item
          if (itemData.effects) {
            itemData.effects.forEach(cleanup => cleanup());
            itemData.effects = null;
          }
          // Clear references for GC. Don't set reactive properties to null
          // (evalContext[itemName] = null) to avoid triggering stale effects.
          itemData.evalContext = null;
          itemData.element = null;
          itemData.item = null;
          this.#itemsMap.delete(key);
        }
      }

      // Collect existing keys in their current DOM order
      const oldKeys = [];
      const oldKeySet = new Set();
      for (const [key] of this.#itemsMap) {
        oldKeys.push(key);
        oldKeySet.add(key);
      }

      // Build array of new keys (only those that already exist in DOM)
      const newKeysArray = [];
      newItems.forEach((item, index) => {
        const key = this.#getKey(item, keyAttr, index);
        newKeysArray.push(key);
      });

      // Create/update all items first (before reordering)
      const itemName = this.getAttribute('as') || 'item';
      newItems.forEach((item, index) => {
        const key = this.#getKey(item, keyAttr, index);
        let itemData = this.#itemsMap.get(key);

        if (!itemData) {
          // Create new element with index
          const { element, evalContext, effects } = this.#createItemElement(item, index);
          itemData = { element, item, index, evalContext, effects };
          this.#itemsMap.set(key, itemData);
        } else {
          // Update existing element if item or index changed
          if (itemData.item !== item || itemData.index !== index) {
            itemData.evalContext[itemName] = item;
            itemData.evalContext.index = index;
            itemData.item = item;
            itemData.index = index;
          }
        }
      });

      // Use LIS-based reordering for optimal DOM moves
      this.#reorderWithLIS(newKeysArray, oldKeys, oldKeySet);
    }

    /**
     * Reorder DOM elements using LIS (Longest Increasing Subsequence) optimization.
     * This minimizes DOM moves by finding elements that are already in correct relative order.
     */
    #reorderWithLIS(newKeys, oldKeys, oldKeySet) {
      // If no existing elements, just append all in order
      if (oldKeys.length === 0) {
        newKeys.forEach(key => {
          const itemData = this.#itemsMap.get(key);
          if (itemData?.element) {
            this.appendChild(itemData.element);
          }
        });
        return;
      }

      // Map old keys to their positions
      const oldKeyIndex = new Map(oldKeys.map((key, i) => [key, i]));

      // Get positions of new keys in old order (only for keys that existed)
      const positions = [];
      const keyAtPosition = [];
      newKeys.forEach((key, newIndex) => {
        if (oldKeySet.has(key)) {
          positions.push(oldKeyIndex.get(key));
          keyAtPosition.push({ key, newIndex });
        }
      });

      // Find LIS - these elements don't need to move
      const lisIndices = this.#longestIncreasingSubsequence(positions);
      const stablePositions = new Set(lisIndices.map(i => positions[i]));

      // Determine which keys are stable (in LIS)
      const stableKeys = new Set();
      keyAtPosition.forEach((item, i) => {
        if (stablePositions.has(positions[i])) {
          stableKeys.add(item.key);
        }
      });

      // Move elements: iterate in reverse, placing each before its successor
      let nextSibling = null;
      for (let i = newKeys.length - 1; i >= 0; i--) {
        const key = newKeys[i];
        const itemData = this.#itemsMap.get(key);
        if (!itemData?.element) continue;

        const element = itemData.element;
        const isNew = !oldKeySet.has(key);
        const needsMove = isNew || !stableKeys.has(key);

        if (needsMove) {
          // Element needs to be moved/inserted
          if (nextSibling) {
            if (element.nextSibling !== nextSibling) {
              this.insertBefore(element, nextSibling);
            }
          } else {
            if (element !== this.lastChild) {
              this.appendChild(element);
            }
          }
        }

        nextSibling = element;
      }
    }

    /**
     * Find Longest Increasing Subsequence indices using binary search.
     * Time: O(n log n), Space: O(n)
     * Returns indices into the input array that form the LIS.
     */
    #longestIncreasingSubsequence(arr) {
      const n = arr.length;
      if (n === 0) return [];

      // tails[i] = index in arr of smallest tail element for LIS of length i+1
      const tails = [];
      // parent[i] = index of previous element in LIS ending at arr[i]
      const parent = new Array(n).fill(-1);

      for (let i = 0; i < n; i++) {
        const val = arr[i];

        // Binary search for position
        let lo = 0;
        let hi = tails.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (arr[tails[mid]] < val) {
            lo = mid + 1;
          } else {
            hi = mid;
          }
        }

        // lo is the position where val should go
        if (lo > 0) {
          parent[i] = tails[lo - 1];
        }

        if (lo === tails.length) {
          tails.push(i);
        } else {
          tails[lo] = i;
        }
      }

      // Reconstruct LIS indices
      const lis = [];
      let k = tails[tails.length - 1];
      while (k >= 0) {
        lis.push(k);
        k = parent[k];
      }
      lis.reverse();

      return lis;
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

      // Set up prototype chain for expression resolution.
      // If inside another Loop (_vedaEvalContext exists), chain directly to it:
      //   evalContext { item, index } -> outerEvalCtx { category, index } -> parent.state -> parent
      // Otherwise use parent component's state:
      //   evalContext { item, index } -> parent.state -> parent
      if (this._vedaEvalContext) {
        Object.setPrototypeOf(evalContext, this._vedaEvalContext);
      } else if (this._vedaParentContext) {
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


