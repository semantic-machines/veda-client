import {Component, html} from '../dist/index.js';
import './SettingsComponent.js';

export default class AppComponent extends Component(HTMLElement) {
  render () {
    return html`
      <style>
        a {color: red;}
      </style>
      <div>
        <h4>
          <a href="#/app/${this.model.id}">
            <span property="id"></span>
          </a>
        </h4>
        <strong about="d:TestSettings1" property="rdfs:label"></strong>
        <em about="d:TestSettings1" property="rdfs:comment"></em>
        <ul property="rdfs:label"><li><span><slot></slot></span></li></ul>
        <div rel="v-s:hasSettings">
          <veda-settings></veda-settings>
        </div>
        <hr>
        <div rel="v-s:hasSettings" data-shadow="true">
          <style>
            * {font-style: italic;}
          </style>
          <span property="rdfs:label"></span>
          <ul rel="v-s:hasApplication">
            <li property="rdfs:label"></li>
          </ul>
        </div>
      </div>
    `;
  }
}

customElements.define('veda-app', AppComponent);
