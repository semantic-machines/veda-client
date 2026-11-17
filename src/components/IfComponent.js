import Component from './Component.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';
import {factories} from '../template/factories.js';
import {compileTemplate} from '../template/Template.js';

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
    #template = null;
    #contentInstance = null;
    #currentContent = null;
    #placeholder = null;
    #isDisconnected = false;

    async connectedCallback() {
      this.#isDisconnected = false;
      this.#placeholder = document.createComment('veda-if');
      this._vedaParentContext = this._findParentComponent();

      this.#template = this._compiledTemplate ||
        (this.template ? compileTemplate(this.template) : null);

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
      }, { component: this, internal: true });
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
      this.#template = null;
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
      const instance = this.#contentInstance;
      const nodes = this.#currentContent;
      this.#contentInstance = null;
      this.#currentContent = null;

      instance?.destroy();
      if (nodes) {
        for (const node of nodes) node.remove?.();
      }
    }

    #updateVisibility(show) {
      if (this.#isDisconnected) return;

      const hasContent = !!this.#contentInstance;

      if (show && !hasContent) {
        if (!this.#template) return;

        this.#placeholder?.remove();

        const evalContext = this.#createEvalContext();
        const instance = this.#template.instantiate(evalContext, this, {values: this._templateValues || []});
        const contentNodes = Array.from(instance.fragment.childNodes);

        this.appendChild(instance.fragment);
        this.#contentInstance = instance;
        this.#currentContent = contentNodes;
        this._addChildrenRendered(instance.childrenRendered);
      } else if (!show && hasContent) {
        this.#teardownContent();
        if (this.#placeholder) this.appendChild(this.#placeholder);
      }
    }

    #createEvalContext() {
      if (this._vedaEvalContext) return this._vedaEvalContext;

      const parent = this._vedaParentContext;
      if (!parent?.state) return parent;

      const evalContext = parent.state;
      Object.setPrototypeOf(evalContext, parent);
      return evalContext;
    }

    _onTemplateValuesChanged(values) {
      this.#contentInstance?.setValues(values);
    }

    _getEventListenersCount() {
      return super._getEventListenersCount() + (this.#contentInstance?.getEventListenersCount?.() || 0);
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

factories.If = IfComponent;

export { If };
