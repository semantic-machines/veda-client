import Component from './Component.js';

export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponent extends Component(Class) {
    static name = 'ValueComponent';

    static observedAttributes = [...super.observedAttributes, 'property', 'rel'];

    async connectedCallback () {
      this.prop = this.property ?? this.rel;
      this.handler = this.render.bind(this);
      await super.populate();
      this.model.on(this.prop, this.handler);
      this.render();
    }

    render () {
      const container = this.shadow ?
        this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot) :
        this;
      container.innerHTML = '';
      if (!this.model.hasValue(this.prop)) return;
      if (Array.isArray(this.model[this.prop])) {
        this.model[this.prop].forEach((value) => this.renderValue(value, container));
      } else {
        this.renderValue(this.model[this.prop], container);
      }
    }

    renderValue (value, container) {
      const node = document.createTextNode(value.toString());
      container.appendChild(node);
    }

    removed () {
      this.model.off(this.prop, this.handler);
    }
  };
}
