import {Component, html} from '../../../src/index.js';

export default class AppSimple extends Component(HTMLElement) {
  static tag = 'veda-app-simple';


  testMethod6 (e) {
    alert('testMethod6');
  }

  render () {
    return html`
      <div rel="v-s:hasSettings">
        <p about="{this.state.model.id}" is="${ParagraphComponent}">
          <span property="rdfs:label"></span>
          <button onclick="{testMethod6}">Test button 6</button>
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
