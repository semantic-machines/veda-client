import {Component, html} from '../../../src/index.js';

export default class SettingsComponent extends Component(HTMLElement) {
  static tag = 'veda-settings';

  testMethod3 (e) {
    alert('testMethod3');
  }

  testMethod4 (e) {
    alert('testMethod4');
  }

  testMethod5 (e) {
    alert('testMethod5');
  }

  render() {
    return html`
      Separate component
      <h2>
        <a href="#/settings/{this.model.id}">
          <span property="id"></span>
        </a>
      </h2>
      <p about="{this.model.v-s:hasApplication?.0.id}" is="${ParagraphComponent}">
        <span property="rdfs:label"></span>
        <button onclick="{testMethod4}">Test button 4</button>
      </p>
      <ul property="rdfs:label"><li></li></ul>
      <hr>
      <div rel="v-s:hasApplication">
        <div style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;">
          id = {this.model.id}
          <p property="rdfs:label"></p>
          <a property="id" href="#/app1/{this.model.id}"></a>
          <button onclick="{testMethod5}">Test button 5</button>
        </div>
      </div>
      <div about="rdfs:label" style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;">
        <div rel="rdf:type"></div>
        <div property="rdfs:label"></div>
        <button onclick="{testMethod3}">Test button 3</button>
      </div>
    `;
  }
}
customElements.define(SettingsComponent.tag, SettingsComponent);

class ParagraphComponent extends Component(HTMLParagraphElement) {
  static tag = 'veda-paragraph';
}
customElements.define(ParagraphComponent.tag, ParagraphComponent, {extends: 'p'});
