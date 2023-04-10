import Component, {html} from '../dist/Component.js';

export default class TestSettingsComponent extends Component(HTMLElement) {
  pre (root) {
    root.append('!!!');
  }

  render () {
    return html`
      <h5>
        <a href="#/${this.model.id}">
          <span property="id"></span>
        </a>
        <ul property="rdfs:label"><li></li></ul>
      </h5>
    `;
  }

  post (root) {
    root.append('>>>');
  }
}
