import Component from '../src/Component.js';

export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponent extends Component(Class) {
    template;

    async connectedCallback () {
      await super.populate();
      this.prop = this.getAttribute('property') ?? this.getAttribute('rel');
      this.handler = this.render.bind(this);
      this.model.on(this.prop, this.handler);
      this.render();
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
      const node = document.createTextNode(value.toString());
      this.appendChild(node);
    }

    removed () {
      this.model.off(this.prop, this.handler);
    }
  };
}
