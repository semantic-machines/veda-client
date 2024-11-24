import {Component, html} from '../../src/index.js';

export default class SettingsComponent extends Component(HTMLElement) {
  static tag = 'veda-settings';

  testMethod3 (e) {
    alert('testMethod3');
  }

  render() {
    return html`
      Separate component
      <h2>
        <a href="#/settings/{{this.model.id}}">
          <span property="id"></span>
        </a>
      </h2>
      <ul property="rdfs:label"><li></li></ul>
      <hr>
      <div rel="v-s:hasApplication">
        <div style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;">
          id = {{this.model.id}}
          <p property="rdfs:label"></p>
          <a property="id" href="#/app/{{this.model.id}}"></a>
        </div>
      </div>
      <div about="rdfs:label" style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;">
        <div rel="rdf:type"></div>
        <div property="rdfs:label"></div>
        <button @click="${(e) => this.parent.testMethod3(e)}">Test button 3</button>
      </div>
    `;
  }
}

customElements.define(SettingsComponent.tag, SettingsComponent);
