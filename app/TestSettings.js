import Component, {html} from '../src/Component.js';

export default class TestSettings extends Component(HTMLElement) {
  render () {
    return html`
      <h5>
        <a href="#/${this.model.id}">
          <span is="span-prop-value" about="${this.model.id}" property="id"></span>
        </a>
        <span is="span-prop-value" about="${this.model.id}" property="rdfs:label"></span>
      </h5>
    `;
  }
}
