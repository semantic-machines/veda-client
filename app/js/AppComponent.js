import {Component, html, safe} from '../../src/index.js';
import SettingsComponent from './SettingsComponent.js';

export default class AppComponent extends Component(HTMLElement) {
  static tag = 'veda-app';


  testMethod1 (e) {
    alert('testMethod1');
  }

  testMethod2 (e) {
    alert('testMethod2');
  }

  render () {
    return html`
      <style>
        a {color: red;}
      </style>
      <div>
        <h1 property="rdfs:label"></h1>
        <ul>
          <li property="rdfs:comment"></li>
          <li>{{ this.model['rdfs:comment'][0] }}</li>
          <li>${ this.model['rdfs:comment'][0] }</li>
          <li>${true
            ? html`111 <span>true</span>`
            : html`<span>false</span>`
          }</li>
        </ul>
        <p about="rdfs:label" property="rdfs:label"></p>
        <ul property="rdfs:label"><li><span><slot></slot></span></li></ul>
        <button @click="${(e) => this.testMethod1(e)}">Test button 1</button>
        <p about="v-s:hasSettings" property="rdfs:label"></p>
        <div rel="v-s:hasSettings">
          <${SettingsComponent} about="{{this.model.id}}" style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;"></${SettingsComponent}>
        </div>
        <div rel="v-s:hasSettings" data-shadow="true">
          <style>
            * {font-style: italic;}
          </style>
          <div style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;">
            Inline component
            <h2 property="rdfs:label"></h2>
            <a href="#/settings/{{this.model.id}}">
              {{this.model.id}}
            </a>
            <ul rel="v-s:hasApplication">
              <li property="rdfs:label"></li>
            </ul>
            <button @click="${(e) => this.parent.testMethod2(e)}">Test button 2</button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define(AppComponent.tag, AppComponent);
