import ValueComponent from './ValueComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  return class RelationComponentClass extends ValueComponent(Class) {
    async renderValue (value, container, index) {
      if (!this.template) {
        return super.renderValue(value, container, index);
      }

      const originalModel = this.model;

      try {
        this.model = value;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.template;
        
        // Check if there's a <template> element (old syntax support)
        const templateEl = tempDiv.querySelector('template');
        
        let fragment;
        if (templateEl) {
          // Old syntax: <rel><template>...</template></rel>
          fragment = templateEl.content.cloneNode(true);
        } else {
          // New syntax: <rel>...</rel> - use all children as template
          fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
        }

        // Create a temporary element with the model to use as evalContext
        const contextElement = document.createElement('div');
        contextElement.model = value;
        
        this._process(fragment, contextElement);

        const walker = document.createTreeWalker(
          fragment,
          NodeFilter.SHOW_ELEMENT
        );

        let node = walker.nextNode();
        while (node) {
          if ((node.tagName.includes('-') || node.hasAttribute('is')) && !node.hasAttribute('about')) {
            node.model = value;
          }
          node = walker.nextNode();
        }

        container.append(fragment);
      } finally {
        this.model = originalModel;
      }
    }
  };
}
