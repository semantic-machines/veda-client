import {Component, safe} from '../../src/index.js';

function getLiteralValue (model, property) {
  const currentLang = document.documentElement.lang.toUpperCase();
  const regex = /\^\^[a-z]{2}$/i;
  return model.hasValue(property)
    ? model[property]
        ?.filter(str => !regex.test(str) || str.toString().toUpperCase().endsWith(`^^${currentLang}`))
        .map(str => str.toString().split(regex)[0])
        .join(' ') ?? ''
    : '';
}

export default class Literal extends Component(HTMLElement) {
  static tag = 'veda-literal';

  static get observedAttributes() {
    return ['property', 'max-chars'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'property') {
      this.property = newValue;
    } else if (name === 'max-chars') {
      this.maxChars = Number(newValue) || Infinity;
    }
  }

  populate() {
    return super.populate();
  }

  render () {
    const value = safe(getLiteralValue(this.model, this.property));
    const truncated = value.slice(0, this.maxChars);
    return value.length > this.maxChars ? `${truncated}...` : truncated;
  }

  up = () => {
    this.update();
  }

  added () {
    this.model.on(this.property, this.up);
  }

  removed () {
    this.model.off(this.property, this.up);
  }
}

customElements.define(Literal.tag, Literal);
