import {Component, html} from '../../src/index.js';

export default class SettingsComponent extends Component(HTMLElement) {
  static tag = 'veda-settings';

  testMethod3 (e) {
    alert(`testMethod3 ${e.target.id}`);
  }

  testMethod4 (e) {
    alert(`testMethod4 ${e.target.id}`);
  }

  testMethod5 (e) {
    alert(`testMethod5 ${e.target.id}`);
  }

  render() {
    return html`
      Separate component
      <h2>
        <a href="#/settings/{{this.model.id}}">
          <span property="id"></span>
        </a>
      </h2>
      <p about="{{this.model['v-s:hasApplication']?.[0].id}}" is="${ParagraphComponent}">
        <span property="rdfs:label"></span>
        <button id="testButton4" on:click="(e) => this.parentNode.testMethod4(e)">Test button 4</button>
      </p>
      <ul property="rdfs:label"><li></li></ul>
      <hr>
      <div rel="v-s:hasApplication">
        <div style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;">
          id = {{this.model.id}}
          <p property="rdfs:label"></p>
          <a property="id" href="#/app1/{{this.model.id}}"></a>
          <button id="testButton5" onclick="this.parentNode.parentNode.parentNode.testMethod5(event)">Test button 5</button>
        </div>
      </div>
      <div about="rdfs:label" style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;">
        <div rel="rdf:type"></div>
        <div property="rdfs:label"></div>
        <button id="testButton3" on:click="(e) => this.parentNode.testMethod3(e)">Test button 3</button>
      </div>
    `;
  }
}
customElements.define(SettingsComponent.tag, SettingsComponent);

class ParagraphComponent extends Component(HTMLParagraphElement) {
  static tag = 'veda-paragraph';
}
customElements.define(ParagraphComponent.tag, ParagraphComponent, {extends: 'p'});
