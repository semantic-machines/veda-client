import ValueComponent from './ValueComponent.js';
import {reactive} from '../Reactive.js';

export default function RelationComponent (Class = HTMLElement) {
  return class RelationComponentClass extends ValueComponent(Class) {
    async renderValue (value, container, index) {
      const hasCustomContent = this.template?.trim();
      if (!hasCustomContent) {
        return super.renderValue(value, container, index);
      }

      const originalModel = this.state.model;

      try {
        this.state.model = value;

        const template = document.createElement('template');
        template.innerHTML = this.template;
        const fragment = template.content.cloneNode(true);

        // Create pseudo-component context with state.model for consistency
        // This allows using {this.state.model.id} syntax everywhere
        const pseudoState = reactive({ model: value });
        const evalContext = { state: pseudoState };

        // Set up prototype chain: pseudoState -> this (for method access)
        Object.setPrototypeOf(pseudoState, this);

        this._process(fragment, evalContext);

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
      } finally {
        this.state.model = originalModel;
      }
    }
  };
}
