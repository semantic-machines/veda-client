import Component from './Component.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';

/**
 * If component for conditional rendering
 *
 * Usage (v3.0):
 * <veda-if condition="{this.state.showDetails}">
 *   <div>Details content</div>
 * </veda-if>
 *
 * Multiple children:
 * <veda-if condition="{this.state.isLoggedIn}">
 *   <h1>Welcome</h1>
 *   <user-profile></user-profile>
 * </veda-if>
 */
export default function IfComponent(Class = HTMLElement) {
  return class IfComponentClass extends Component(Class) {
    static tag = 'veda-if';

    #ifEffect = null;
    #template = null;
    #currentContent = null;
    #contentEffects = null;  // Effects for current content
    #placeholder = null;
    #isDisconnected = false;  // Prevent double disconnectedCallback

    async connectedCallback() {
      this.#isDisconnected = false;  // Reset on reconnect
      this.#placeholder = document.createComment('veda-if');
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

      const conditionExpr = this.getAttribute('condition');
      if (!conditionExpr) {
        console.warn('If component requires "condition" attribute');
        return;
      }

      this.#ifEffect = effect(() => {
        const condition = this.#evaluateCondition(this.getAttribute('condition'));
        this.#updateVisibility(condition);
      }, { component: this._vedaParentContext });
    }

    disconnectedCallback() {
      // Prevent double disconnectedCallback calls
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;

      if (this.#ifEffect) {
        this.#ifEffect();
        this.#ifEffect = null;
      }
      // Cleanup content effects
      if (this.#contentEffects) {
        this.#contentEffects.forEach(cleanup => cleanup());
        this.#contentEffects = null;
      }
      this.#currentContent = null;
      this.#template = null;
      this._vedaParentContext = null;
      super.disconnectedCallback?.();
    }

    #evaluateCondition(expr) {
      try {
        // Prefer inherited eval context (e.g. from Loop iteration) over parent component.
        // _vedaEvalContext has loop variables in scope via prototype chain.
        const context = this._vedaEvalContext || this._vedaParentContext;

        if (!context) {
          return false;
        }

        // Check for unsafe expression !{ }
        const unsafeMatch = expr.trim().match(/^!\{(.+)\}$/);
        if (unsafeMatch) {
          const value = ExpressionParser.evaluateUnsafe(unsafeMatch[1].trim(), context);
          return !!value;
        }

        // Safe expression { }
        const cleanExpr = expr.trim().replace(/^\{/, '').replace(/\}$/, '');
        const value = ExpressionParser.evaluate(cleanExpr, context);
        return !!value;
      } catch (error) {
        console.error('If: Failed to evaluate condition expression:', expr, error);
        return false;
      }
    }

  #updateVisibility(show) {
    const hasContent = this.#currentContent?.length > 0;

    if (show && !hasContent) {
      const tempContainer = document.createElement('div');
      tempContainer.appendChild(this.#template.cloneNode(true));

      const evalContext = this.#createEvalContext();

      // Capture effects created during _process for this content
      const effectsStartIndex = this._getRenderEffectsCount();
      this._process(tempContainer, evalContext);
      this.#contentEffects = this._extractRenderEffects(effectsStartIndex);

      const fragment = document.createDocumentFragment();
      while (tempContainer.firstChild) {
        fragment.appendChild(tempContainer.firstChild);
      }
      tempContainer.innerHTML = ''; // Clear temp to help GC

      this.appendChild(fragment);
      this.#currentContent = Array.from(this.childNodes).filter(n => n !== this.#placeholder);

    } else if (!show && hasContent) {
      // First cleanup effects created by If itself
      if (this.#contentEffects) {
        this.#contentEffects.forEach(cleanup => cleanup());
        this.#contentEffects = null;
      }
      // Remove DOM nodes - browser will call disconnectedCallback for custom elements
      this.#currentContent.forEach(node => {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });
      this.#currentContent = null;
      this.appendChild(this.#placeholder);
    }
  }

  #createEvalContext() {
    // If inherited eval context exists (e.g. from enclosing Loop), use it directly.
    // It already has the correct prototype chain: { item, index } -> parent.state -> parent
    if (this._vedaEvalContext) {
      return this._vedaEvalContext;
    }

    const parent = this._vedaParentContext;
    if (!parent?.state) return parent;

    const evalContext = parent.state;
    Object.setPrototypeOf(evalContext, parent);
    return evalContext;
  }

    render() {
      return '';
    }
  };
}

// Define the component only if running in browser
const If = (() => {
  if (typeof customElements !== 'undefined') {
    const IfComponentClass = IfComponent(HTMLElement);
    customElements.define(IfComponentClass.tag, IfComponentClass);
    return IfComponentClass;
  }
  return IfComponent;
})();

export { If };


