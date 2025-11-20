import ValueComponent from './ValueComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  return class RelationComponentClass extends ValueComponent(Class) {
    async renderValue (value, container, index) {
      // Check if we have custom rendering content
      const hasCustomContent = this.template && this.template.trim().length > 0;

      if (!hasCustomContent) {
        return super.renderValue(value, container, index);
      }

      const originalModel = this.model;

      try {
        this.model = value;

        // Use <template> element to parse HTML - it preserves all element types
        // including table elements (tr, td, etc) without browser auto-correction
        const template = document.createElement('template');
        template.innerHTML = this.template;

        // Use template content as-is
        const fragment = template.content.cloneNode(true);

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
