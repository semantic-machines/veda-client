import Component, {html} from '../src/Component.js';
import TestSettings from './TestSettings.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';

const DivPropValue = PropertyComponent(HTMLDivElement);
const DivRelValue = RelationComponent(HTMLDivElement);
const SpanPropValue = PropertyComponent(HTMLSpanElement);

customElements.define('div-prop-value', DivPropValue, {extends: 'div'});
customElements.define('div-rel-value', DivRelValue, {extends: 'div'});
customElements.define('span-prop-value', SpanPropValue, {extends: 'span'});
customElements.define('test-settings', TestSettings);

export default class TestApp extends Component(HTMLElement) {
  render () {
    return html`
      <style>
        a {color: red;}
      </style>
      <div>
        <h4>
          <a href="#/${this.model.id}">
            <span is="span-prop-value" about="${this.model.id}" property="id"></span>
          </a>
        </h4>
        <div is="div-prop-value" about="${this.model.id}" property="rdfs:label"></div>
        <span is="span-prop-value" about="${this.model.id}" property="rdfs:label"></span>
        <br>
        <div is="div-rel-value" about="${this.model.id}" rel="v-s:hasSettings">
          <test-settings></test-settings>
        </div>
      </div>
    `;
  }
}
