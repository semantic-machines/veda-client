import {Component, safe} from '../../../src/index.js';

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

  static observedAttributes = ['property', 'max-chars'];

  render () {
    const maxChars = Number(this.maxChars) || Infinity;
    const value = safe(getLiteralValue(this.model, this.property));
    const truncated = value.slice(0, maxChars);
    return value.length > maxChars ? `${truncated}...` : truncated;
  }

  added () {
    this.property = this.getAttribute('property');
    this.maxChars = this.getAttribute('max-chars');
  }
}

customElements.define(Literal.tag, Literal);
