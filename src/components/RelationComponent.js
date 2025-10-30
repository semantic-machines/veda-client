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
        const templateEl = tempDiv.querySelector('template');

        if (!templateEl) {
          console.warn('[RelationComponent] No <template> element found in template HTML');
          return super.renderValue(value, container, index);
        }

        const fragment = templateEl.content.cloneNode(true);

        this._process(fragment);

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
