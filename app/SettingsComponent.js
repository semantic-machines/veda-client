import {Component, html} from '../dist/index.js';

export default class SettingsComponent extends Component(HTMLElement) {
  pre (root) {
    root.append('!!!');
  }

  render () {
    return html`
      <h5>
        <a href="#/settings/{{this.model.id}}">
          <span property="id"></span>
        </a>
        <ul property="rdfs:label"><li></li></ul>
        <div rel="v-s:hasApplication">
          <span property="rdfs:label"></span>
          <a property="id" href="#/app/{{this.model.id}}"></a>
        </div>

        <i rel="v-s:hasApplication">
          {{this.model.id}}
          <a href="#/app/{{this.model.id}}">
            <span property="id"></span>
          </a>
        </i>
      </h5>
      <hr>
      <div about="rdfs:label" data-shadow="true">
        <div rel="rdf:type"></div>
        <div property="rdfs:label"></div>
      </div>
    `;
  }

  post (root) {
    root.append('>>>');
  }
}

customElements.define('veda-settings', SettingsComponent);
