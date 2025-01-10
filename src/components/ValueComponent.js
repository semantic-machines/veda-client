import Component from './Component.js';

export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponent extends Component(Class) {
    static name = 'ValueComponent';

    added () {
      this.prop = this.getAttribute('property') ?? this.getAttribute('rel');
      this.handler = this.update.bind(this);
      this.model.on(this.prop, this.handler);
    }

    removed () {
      if (this.prop && this.handler) {
        this.model.off(this.prop, this.handler);
      }
    }

    render () {
      const container = this.hasAttribute('shadow')
        ? this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot)
        : this;
      container.replaceChildren();
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
  };
}
