import Component from './Component.js';

export default function InlineComponent (Class = HTMLElement) {
  class InlineComponent extends Component(Class) {
    static name = 'InlineComponent';

    async connectedCallback () {
      await this.populate();
      this.innerHTML = '';
      if (!this.template) return;
      const template = document.createElement('template');
      template.innerHTML = this.template;
      const fragment = template.content;

      this.root = fragment;

      this.process();

      const container = this.dataset.shadow ?
        this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot) :
        this;
      container.appendChild(fragment);

      this.root = container;
    }
  };

  return InlineComponent;
}
