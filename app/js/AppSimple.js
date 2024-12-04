import {Component, html} from '../../src/index.js';
import Literal from './Literal.js';

export default class AppSimple extends Component(HTMLElement) {
  static tag = 'veda-app-simple';

  render () {
    return html`
      <div about="d:TestSettings1">
        <p about="{{this.model.id}}" is="${ParagraphComponent}">
          <span property="rdfs:label"></span>
        </p>
      </div>
    `;
  }
}

customElements.define(AppSimple.tag, AppSimple);

class ParagraphComponent extends Component(HTMLParagraphElement) {
  static tag = 'veda-paragraph';
}

//customElements.define(ParagraphComponent.tag, ParagraphComponent, {extends: 'p'});
