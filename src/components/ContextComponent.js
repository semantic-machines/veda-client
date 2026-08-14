import Component from './Component.js';

/**
 * Provides reactive values to descendants via this.context.
 *
 * <veda-context :theme="{this.state.theme}" :locale="{this.state.locale}">
 *   <child-view></child-view>
 * </veda-context>
 *
 * In a descendant: {this.context.theme}
 */
export default function ContextComponent(Class = HTMLElement) {
  return class ContextComponentClass extends Component(Class) {
    static tag = 'veda-context';

    async connectedCallback() {
      this._vedaParentContext = this._findParentComponent();
      await super.connectedCallback();
    }

    _processEvalContext() {
      return this._vedaEvalContext || this._vedaParentContext || null;
    }

    render() {
      return this.template ?? '';
    }
  };
}

const Context = (() => {
  if (typeof customElements !== 'undefined') {
    const ContextComponentClass = ContextComponent(HTMLElement);
    customElements.define(ContextComponentClass.tag, ContextComponentClass);
    return ContextComponentClass;
  }
  return ContextComponent;
})();

export {Context};
