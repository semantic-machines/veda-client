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

      this.#placeholder = document.createComment('veda-if');

      // Find and store parent component context for expression evaluation
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
        console.warn('If: No template content found');
        this.#template = document.createDocumentFragment();
      }

      const conditionExpr = this.getAttribute('condition');
      if (!conditionExpr) {
        console.warn('If component requires "condition" attribute');
        return;
      }

      this.#ifEffect = effect(() => {
        const currentCondition = this.getAttribute('condition');
        const condition = this.#evaluateCondition(currentCondition);
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
        const cleanExpr = expr.replace(/^{|}$/g, '').trim();

        // Use cached parent context
        const context = this._vedaParentContext;

        if (!context) {
          console.warn('If: Cannot find parent component context');
          return false;
        }

        const value = ExpressionParser.evaluate(cleanExpr, context);
        return !!value;
      } catch (error) {
        console.error('If: Failed to evaluate condition expression:', expr, error);
        return false;
      }
    }

  #updateVisibility(show) {
    // Check if current content nodes are still in the DOM
    const hasValidContent = this.#currentContent &&
      this.#currentContent.length > 0 &&
      this.#currentContent.some(n => n.parentNode === this);

    if (show && !hasValidContent) {
      const content = this.#template.cloneNode(true);

      const tempContainer = document.createElement('div');
      tempContainer.appendChild(content);

      // Pass parent context to _process so expressions are evaluated in parent's context
      this._process(tempContainer, this._vedaParentContext);

      const processedContent = document.createDocumentFragment();
      while (tempContainer.firstChild) {
        processedContent.appendChild(tempContainer.firstChild);
      }

      this.appendChild(processedContent);
      this.#currentContent = Array.from(this.childNodes).filter(n => n !== this.#placeholder);

    } else if (!show && hasValidContent) {
      this.#currentContent.forEach(node => {
        if (node.parentNode === this) {
          this.removeChild(node);
        }
      });
      this.#currentContent = null;

      this.appendChild(this.#placeholder);
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


