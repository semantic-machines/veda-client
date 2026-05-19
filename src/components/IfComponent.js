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
 */
export default function IfComponent(Class = HTMLElement) {
  return class IfComponentClass extends Component(Class) {
    static tag = 'veda-if';

    #ifEffect = null;
    #templateEl = null;  // <template> parsed once; clone via .content; cleared on disconnect
    #currentContent = null;
    #contentEffects = null;
    #placeholder = null;
    #isDisconnected = false;

    async connectedCallback() {
      this.#isDisconnected = false;
      this.#placeholder = document.createComment('veda-if');
      this._vedaParentContext = this._findParentComponent();

      this.#parseTemplate();
      this.replaceChildren();
      this._deferRendered();
      await super.connectedCallback();

      const conditionExpr = this.getAttribute('condition');
      if (!conditionExpr) {
        console.warn('If component requires "condition" attribute');
        this._resolveDeferred();
        return;
      }

      this.#ifEffect = effect(() => {
        const condition = this.#evaluateCondition(this.getAttribute('condition'));
        this.#updateVisibility(condition);
      }, { component: this });
      this._resolveDeferred();
    }

    disconnectedCallback() {
      if (this.#isDisconnected) return;
      this.#isDisconnected = true;

      if (this.#ifEffect) {
        this.#ifEffect();
        this.#ifEffect = null;
      }
      this.#teardownContent();
      this.replaceChildren();
      this.#placeholder = null;
      this.#templateEl = null;
      this._vedaParentContext = null;
      this._vedaEvalContext = null;
      super.disconnectedCallback?.();
    }

    #evaluateCondition(expr) {
      try {
        if (this.#isDisconnected) return false;

        const context = this._vedaEvalContext || this._vedaParentContext;
        if (!context) return false;

        const cleanExpr = expr.trim().replace(/^\{/, '').replace(/\}$/, '');
        return !!ExpressionParser.evaluateAuto(cleanExpr, context);
      } catch (error) {
        console.error('If: Failed to evaluate condition expression:', expr, error);
        return false;
      }
    }

    #teardownContent() {
      if (this.#contentEffects) {
        this.#contentEffects.forEach(cleanup => cleanup());
        this.#contentEffects = null;
      }
      if (this.#currentContent) {
        for (const node of this.#currentContent) {
          node.remove?.();
        }
        this.#currentContent = null;
      }
    }

    #updateVisibility(show) {
      if (this.#isDisconnected) return;

      const hasContent = this.#currentContent?.length > 0;

      if (show && !hasContent) {
        if (!this.#templateEl) return;

        const tempContainer = document.createElement('div');
        tempContainer.appendChild(this.#templateEl.content.cloneNode(true));

        const evalContext = this.#createEvalContext();
        const effectsStartIndex = this._getRenderEffectsCount();
        this._process(tempContainer, evalContext);
        this.#contentEffects = this._extractRenderEffects(effectsStartIndex);

        const contentNodes = [];
        let node;
        while ((node = tempContainer.firstChild)) {
          this.appendChild(node);
          contentNodes.push(node);
        }
        this.#currentContent = contentNodes;

      } else if (!show && hasContent) {
        this.#teardownContent();
        this.appendChild(this.#placeholder);
      }
    }

    #parseTemplate() {
      this.#templateEl = null;
      if (!this.template) return;
      this.#templateEl = document.createElement('template');
      this.#templateEl.innerHTML = this.template;
    }

    #createEvalContext() {
      if (this._vedaEvalContext) return this._vedaEvalContext;

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

const If = (() => {
  if (typeof customElements !== 'undefined') {
    const IfComponentClass = IfComponent(HTMLElement);
    customElements.define(IfComponentClass.tag, IfComponentClass);
    return IfComponentClass;
  }
  return IfComponent;
})();

export { If };
