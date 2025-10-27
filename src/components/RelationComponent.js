import ValueComponent from './ValueComponent.js';

export default function RelationComponent (Class = HTMLElement) {
  return class RelationComponentClass extends ValueComponent(Class) {
    async renderValue (value, container, index) {
      if (!this.template) {
        return super.renderValue(value, container, index);
      }

      // Save current model
      const originalModel = this.model;

      try {
        // Temporarily set model to value for processing
        this.model = value;

        // Create fragment from template
        const template = document.createElement('template');
        template.innerHTML = this.template;
        const fragment = template.content;

        // Process fragment (uses this.model = value)
        // All components will be children in DOM tree for method lookup
        this._process(fragment);

        // Append fragment children to container
        container.append(fragment);
      } finally {
        // Restore original model
        this.model = originalModel;
      }
    }
  };
}
