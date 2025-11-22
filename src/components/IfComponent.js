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
    #placeholder = null;

    async connectedCallback() {
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
        const cleanExpr = expr.trim().replace(/^\{/, '').replace(/\}$/, '');

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
    const hasContent = this.#currentContent?.length > 0;

    if (show && !hasContent) {
      const tempContainer = document.createElement('div');
      tempContainer.appendChild(this.#template.cloneNode(true));

      const evalContext = this.#createEvalContext();
      this._process(tempContainer, evalContext);

      const fragment = document.createDocumentFragment();
      while (tempContainer.firstChild) {
        fragment.appendChild(tempContainer.firstChild);
      }

      this.appendChild(fragment);
      this.#currentContent = Array.from(this.childNodes).filter(n => n !== this.#placeholder);

    } else if (!show && hasContent) {
      this.#currentContent.forEach(node => node.remove());
      this.#currentContent = null;
      this.appendChild(this.#placeholder);
    }
  }

  #createEvalContext() {
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


