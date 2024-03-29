import Component from './Component.js';

export default function ValueComponent (Class = HTMLElement) {
  return class ValueComponent extends Component(Class) {
    template;

    static get observedAttributes () {
      return ['lang'];
    }

    attributeChangedCallback (name, oldValue, newValue) {
      if (!oldValue || oldValue === newValue) return;
      this.render();
    }

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
      if (typeof value === 'string') {
        const lang = document.documentElement.lang;
        this.setAttribute('lang', lang);
        if (value.indexOf(`^^${lang.toUpperCase()}`) > 0) {
          // Cut language suffix
          value = value.substring(0, value.indexOf('^^'));
        } else if (value.indexOf('^^') < 0) {
          // Keep value untouched
        } else return;
      }
      const node = document.createTextNode(value.toString());
      container.appendChild(node);
    }

    removed () {
      this.model.off(this.prop, this.handler);
    }
  };
}
