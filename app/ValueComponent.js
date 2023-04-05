import Model from '../src/Model.js';

export default function ValueComponent (Class = HTMLElement) {
  return class PropertyComponent extends Class {
    async connectedCallback () {
      const about = this.getAttribute('about');
      const prop = this.getAttribute('property') ?? this.getAttribute('rel');
      const template = this.innerHTML.trim();
      const model = new Model(about);
      const handler = this.render.bind(this);

      this.model = model;
      this.prop = prop;
      this.handler = handler;
      this.template = template;

      if (!model.isNew() && !model.isLoaded()) await model.load();
      model.on(prop, handler);
      this.render();
    }

    disconnectedCallback () {
      this.model.off(this.prop, this.handler);
    }

    render () {
      this.innerHTML = '';
      if (Array.isArray(this.model[this.prop])) {
        this.model[this.prop].forEach((value) => this.renderValue(value));
      } else {
        this.renderValue(this.model[this.prop]);
      }
    }

    renderValue (value) {
      const valueNode = document.createTextNode(value.toString());
      this.appendChild(valueNode);
    }
  };
}
