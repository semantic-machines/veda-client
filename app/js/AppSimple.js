import {Component, html} from '../../src/index.js';
import Literal from './Literal.js';

export default class AppSimple extends Component(HTMLElement) {
  static tag = 'veda-app-simple';

  render () {
    return html`
      Hello, world!
      <div rel="v-s:hasSettings">
        <${Literal} property="rdfs:label"></${Literal}>
        <span about="{{this.model.id}}">
          <${Literal} property="rdfs:comment"></${Literal}>
        </span>
      </div>
      <hr>
      <div about="d:TestSettings1">
        <${Literal} property="rdfs:label"></${Literal}>
      </div>
    `;
  }
}

customElements.define(AppSimple.tag, AppSimple);
