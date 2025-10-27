import Component from './Component.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';

/**
 * If component for conditional rendering
 *
 * Usage:
 * <veda-if condition="{this.showDetails}">
 *   <div>Details content</div>
 * </veda-if>
 *
 * With template:
 * <veda-if condition="{this.isLoggedIn}">
 *   <template>
 *     <user-profile></user-profile>
 *   </template>
 * </veda-if>
 */
export default function IfComponent(Class = HTMLElement) {
  return class IfComponentClass extends Component(Class) {
    static tag = 'veda-if';

    #ifEffect = null;
    #template = null;
    #currentContent = null;
    #placeholder = null;

    async connectedCallback() {
      await super.connectedCallback();

      // Create placeholder comment node
      this.#placeholder = document.createComment('veda-if');

      // Extract template
      const templateEl = this.querySelector('template');
      if (templateEl) {
        this.#template = templateEl.content.cloneNode(true);
        templateEl.remove();
      } else {
        // Use children as template
        this.#template = document.createDocumentFragment();
        while (this.firstChild) {
          this.#template.appendChild(this.firstChild);
        }
      }

      // Get condition getter from attribute
      const conditionExpr = this.getAttribute('condition');
      if (!conditionExpr) {
        console.warn('If component requires "condition" attribute');
        return;
      }

      // Create effect for reactive rendering
      this.#ifEffect = effect(() => {
        const condition = this.#evaluateCondition(conditionExpr);
        this.#updateVisibility(condition);
      });
    }

    disconnectedCallback() {
      if (this.#ifEffect) {
        this.#ifEffect();
        this.#ifEffect = null;
      }
      this.#currentContent = null;
      super.disconnectedCallback?.();
    }

    #evaluateCondition(expr) {
      try {
        // Remove { } if present
        const cleanExpr = expr.replace(/^{|}$/g, '').trim();

        // Use safe ExpressionParser instead of new Function()
        const value = ExpressionParser.evaluate(cleanExpr, this);
        return !!value;
      } catch (error) {
        console.error('If: Failed to evaluate condition expression:', expr, error);
        return false;
      }
    }

    #updateVisibility(show) {
      if (show && !this.#currentContent) {
        // Show: clone template and insert
        const content = this.#template.cloneNode(true);

        // Process the content (for reactive expressions, etc)
        const tempContainer = document.createElement('div');
        tempContainer.appendChild(content);
        this._process(tempContainer);

        // Move processed content back to fragment
        const processedContent = document.createDocumentFragment();
        while (tempContainer.firstChild) {
          processedContent.appendChild(tempContainer.firstChild);
        }

        // Remove placeholder if present
        if (this.#placeholder.parentNode === this) {
          this.removeChild(this.#placeholder);
        }

        // Add content
        this.appendChild(processedContent);
        this.#currentContent = Array.from(this.childNodes);

      } else if (!show && this.#currentContent) {
        // Hide: remove content and add placeholder
        // Browser will automatically call disconnectedCallback for all web components
        this.#currentContent.forEach(node => {
          if (node.parentNode === this) {
            this.removeChild(node);
          }
        });
        this.#currentContent = null;

        // Add placeholder
        this.appendChild(this.#placeholder);
      }
    }

    render() {
      // If component doesn't use standard render
      // It manages its children through conditional rendering
      return '';
    }
  };
}

// Define the component only if running in browser
let If;
if (typeof customElements !== 'undefined') {
  const IfComponentClass = IfComponent(HTMLElement);
  customElements.define(IfComponentClass.tag, IfComponentClass);
  If = IfComponentClass;
} else {
  // Export function for testing in Node.js
  If = IfComponent;
}

export { If };


