import {Component, html} from '../../../src/index.js';
import SettingsComponent from './SettingsComponent.js';
import Literal from './Literal.js';

export default class AppComponent extends Component(HTMLElement) {
  static tag = 'veda-app';

  testMethod1 () {
    alert('testMethod1');
  }

  testMethod2 () {
    alert('testMethod2');
  }

  render () {
    return html`
      <style>
        a {color: red;}

        /* Стилизация таблицы - должна работать несмотря на slot */
        .styled-table {
          border-collapse: collapse;
          margin: 25px 0;
          font-size: 0.9em;
          min-width: 400px;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
        }

        .styled-table thead tr {
          background-color: #009879;
          color: #ffffff;
          text-align: left;
        }

        .styled-table th,
        .styled-table td {
          padding: 12px 15px;
        }

        /* CSS counter для автоматической нумерации строк */
        .styled-table tbody {
          counter-reset: row-number;
        }

        .styled-table tbody > tr {
          counter-increment: row-number;
        }

        .styled-table tbody > tr td:first-child::before {
          content: counter(row-number);
        }

        /* Критично: tbody > tr должен работать */
        .styled-table tbody > tr {
          border-bottom: 1px solid #dddddd;
        }

        .styled-table tbody > tr:nth-of-type(even) {
          background-color: #f3f3f3;
        }

        .styled-table tbody > tr:last-of-type {
          border-bottom: 2px solid #009879;
        }

        .styled-table tbody > tr:hover {
          background-color: #ffe6cc;
          cursor: pointer;
        }
      </style>
      <div>
        <h1 property="rdfs:label"></h1>
        <ul>
          <li property="rdfs:comment"></li>
          <li>{this.state.model.rdfs:comment.0}</li>
          <li>${this.state.model['rdfs:comment']?.[0]}</li>
          <li>${this
            ? html`111 <span>true</span>`
            : html`<span>false</span>`
          }</li>
        </ul>
        <p about="rdfs:label" property="rdfs:label"></p>
        <ul property="rdfs:label"><li><span><slot></slot></span></li></ul>
        <button onclick="{testMethod1}">Test button 1</button>
        <p about="v-s:hasSettings" property="rdfs:label"></p>
        <div rel="v-s:hasSettings">
          <${SettingsComponent} about="{this.state.model.id}" style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;"></${SettingsComponent}>
        </div>
        <div rel="v-s:hasSettings" shadow>
          <span about="{this.state.model.id}">
            <style>
              * {font-style: italic;}
            </style>
            <div style="margin: 0 20px 20px 0; padding: 10px; border: 1px solid gray; display: inline-block;">
              Inline component
              <h2 property="rdfs:label"></h2>
              <a href="#/settings/{this.state.model.id}">
                {this.state.model.id}
              </a>
              <ul rel="v-s:hasApplication">
                <li property="rdfs:label"></li>
              </ul>
              <${Literal} about="{this.state.model.id}" property="rdfs:label"></${Literal}>
              <button onclick="{testMethod2}">Test button 2</button>
            </div>
          </span>
        </div>
      </div>

      <h3>Settings table (проверка CSS с rel внутри tbody)</h3>
      <table class="styled-table">
        <caption>Settings table - zebra stripes и hover должны работать</caption>
        <thead>
          <tr>
            <th>#</th>
            <th>ID</th>
            <th>Label</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody rel="v-s:hasSettings">
          <tr about="{this.state.model.id}">
            <td></td>
            <td style="font-family: monospace;">{this.state.model.id}</td>
            <td><span property="rdfs:label"></span></td>
            <td>
              <button onclick="{testMethod2}" style="padding: 5px 10px;">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>

      <p style="color: #666; font-style: italic;">
        ✅ Если видны чередующиеся цвета строк (zebra stripes)<br>
        ✅ Если строки меняют цвет при наведении (hover)<br>
        ✅ Если кнопка "Edit" работает<br>
        → значит display: contents работает правильно!
      </p>
    `;
  }
}

customElements.define(AppComponent.tag, AppComponent);
