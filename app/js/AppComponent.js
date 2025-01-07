import {Component, html} from '../../src/index.js';
import SettingsComponent from './SettingsComponent.js';
import Literal from './Literal.js';

export default class AppComponent extends Component(HTMLElement) {
  static tag = 'veda-app';

  testMethod1 (e) {
    alert(`testMethod1 ${e.target.id}`);
  }

  testMethod2 (e) {
    alert(`testMethod2 ${e.target.id}`);
  }

  render () {
    return html`
      <style>
        a {color: red;}
      </style>
      <div about="${this.model}">
        <span property="rdfs:label"></span>
      </div>
      <div>
        <h1 property="rdfs:label"></h1>
        <ul>
          <li property="rdfs:comment"></li>
          <li>{{ this.model['rdfs:comment'][0] }}</li>
          <li>${ this.model['rdfs:comment'][0] }</li>
          <li>${this
            ? html`111 <span>true</span>`
            : html`<span>false</span>`
          }</li>
        </ul>
        <p about="rdfs:label" property="rdfs:label"></p>
        <ul property="rdfs:label"><li><span><slot></slot></span></li></ul>
        <button id="testButton1" on:click="${(e) => this.testMethod1(e)}">Test button 1</button>
        <p about="v-s:hasSettings" property="rdfs:label"></p>
        <div rel="v-s:hasSettings">
          <${SettingsComponent} about="{{this.model.id}}" style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;"></${SettingsComponent}>
        </div>
        <div rel="v-s:hasSettings" shadow>
          <span about="{{this.model.id}}">
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
              <${Literal} about="{{this.model.id}}" property="rdfs:label"></${Literal}>
              <button id="testButton2" onclick="document.querySelector('veda-app').testMethod2(event)">Test button 2</button>
            </div>
          </span>
        </div>
      </div>

      <table>
        <caption>Settings table</cation>
        <thead>
          <tr>
            <th>id</th>
            <th about="rdfs:label" property="rdfs:label"></th>
          </tr>
        </thead>
        <tbody rel="v-s:hasSettings">
          <tr about="{{this.model.id}}">
            <td>{{this.model.id}}</td>
            <td property="rdfs:label"></td>
          </tr>
        </tbody>
      </table>
    `;
  }
}

customElements.define(AppComponent.tag, AppComponent);
