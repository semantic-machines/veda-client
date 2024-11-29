import {Component, html} from '../../src/index.js';
import Literal from './Literal.js';

export default class AppSimple extends Component(HTMLElement) {
  static tag = 'veda-app-simple';

  render () {
    return html`
      Hello, world!
      <div rel="v-s:hasSettings">
        <span about="{{this.model.id}}">
          <${Literal} about="{{this.model.id}}" property="rdfs:label"></${Literal}>
        </span>
      </div>
      <hr>
      <div about="d:TestSettings1">
        <${Literal} about="{{this.model.id}}" property="rdfs:label"></${Literal}>
      </div>
    `;
  }
}

customElements.define(AppSimple.tag, AppSimple);
