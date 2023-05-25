import {Component, html} from '../src/index.js';

export default class SettingsComponent extends Component(HTMLElement) {
  pre () {
    this.root.append('!!!');
  }

  render () {
    return html`
      <h5>
        <a href="#/settings/{{this.model.id}}">
          <span property="id"></span>
        </a>
      </h5>

      <ul property="rdfs:label"><li></li></ul>
      <div rel="v-s:hasApplication">
        <span>
          {{this.model.id}}
          <span property="rdfs:label"></span>
          <a property="id" href="#/app/{{this.model.id}}"></a>
        </span>
      </div>

      <br>
      <i rel="v-s:hasApplication">
        {{this.model.id}}
        <a property="id" href="#/app/{{this.model.id}}"></a>
      </i>

      <hr>

      <div about="rdfs:label">
        <div rel="rdf:type"></div>
        <div property="rdfs:label"></div>
      </div>
    `;
  }

  post () {
    this.root.append('>>>');
  }
}

customElements.define('veda-settings', SettingsComponent);
