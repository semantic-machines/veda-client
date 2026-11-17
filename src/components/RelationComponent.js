import ValueComponent from './ValueComponent.js';
import {reactive} from '../Reactive.js';
import {factories} from '../template/factories.js';
import {compileTemplate} from '../template/Template.js';

export default function RelationComponent (Class = HTMLElement) {
  return class RelationComponentClass extends ValueComponent(Class) {
    renderValue (value, container, index) {
      const hasCustomContent = this._compiledTemplate || this.template?.trim();
      if (!hasCustomContent) {
        return super.renderValue(value, container, index);
      }

      const originalModel = this.state.model;

      try {
        this.state.model = value;

        // Create pseudo-component context with state.model for consistency.
        // This allows using {this.state.model.id} syntax everywhere.
        const pseudoState = reactive({ model: value });
        Object.setPrototypeOf(pseudoState, this);
        const evalContext = { state: pseudoState };

        const compiled = this._compiledTemplate || compileTemplate(this.template);
        const instance = compiled.instantiate(
          evalContext,
          this,
          {values: this._templateValues || []},
        );
        const fragment = instance.fragment;

        const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
        let node = walker.nextNode();

        while (node) {
          if ((node.tagName.includes('-') || node.hasAttribute('is')) && !node.hasAttribute('about')) {
            if (!node.state) node.state = reactive({});
            node.state.model = value;
          }
          node = walker.nextNode();
        }

        container.append(fragment);
        return {cleanup: () => instance.destroy(), instance};
      } finally {
        this.state.model = originalModel;
      }
    }
  };
}

factories.Relation = RelationComponent;
