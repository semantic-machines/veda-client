import Model from './Model.js';

export function html (strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i] + (values[i] ?? '');
  }
  return result.replace(/\s+/g, ' ').replace(/\s</g, '<').replace(/<!--.*?-->/g, '').trimEnd();
}

export default function Component (Class = HTMLElement) {
  class Component extends Class {
    render () {
      return html`
        <a href="#/${this.model.id}">${this.model.id}</a>
      `;
    }

    async connectedCallback () {
      const about = this.getAttribute('about');
      const model = new Model(about);
      this.model = model;
      if (!model.isNew() && !model.isLoaded()) await model.load();
      this.attachShadow({mode: 'open'});
      this.shadowRoot.innerHTML = this.render();
    }

    pre (parent, fragment, ...rest) {}
    post (parent, nodes, ...rest) {}
  }

  Object.defineProperty(Component, 'name', {value: `Component(${Class.name})`});

  return Component;
}
