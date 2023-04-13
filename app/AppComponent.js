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
          <a href="#/app/{{this.model.id}}">
            {{this.model.id}}
          </a>
        </h4>
        <strong about="rdfs:label" property="rdfs:label"></strong>
        <ul property="rdfs:label"><li><span><slot></slot></span></li></ul>
        <hr>
        <div rel="v-s:hasSettings">
          <veda-settings></veda-settings>
        </div>
        <hr>
        <div rel="v-s:hasSettings" data-shadow="true">
          <style>
            * {font-style: italic;}
          </style>
          <h5>{{this.model.id}}</h5>
          <strong property="rdfs:label"></strong>
          <ul rel="v-s:hasApplication">
            <li property="rdfs:label"></li>
          </ul>
        </div>
      </div>
    `;
  }
}

customElements.define('veda-app', AppComponent);
