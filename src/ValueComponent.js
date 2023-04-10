import Component from './Component.js';

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
      const container = this.dataset.shadow ?
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
