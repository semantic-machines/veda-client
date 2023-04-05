import Model from './Model.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';

export function html (strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i] + (values[i] ?? '');
  }
  return result.replace(/\s+/g, ' ').replace(/\s</g, '<').replace(/<!--.*?-->/g, '').trimEnd();
}

export default function Component (ElementClass = HTMLElement, ModelClass = Model) {
  class Component extends ElementClass {
    pre (root) {}
    post (root) {}

    render () {
      return html`
        <a href="#/${this.model.id}">${this.model.id}</a>
      `;
    }

    async connectedCallback () {
      const about = this.getAttribute('about');
      const model = new ModelClass(about);
      this.model = model;
      if (!model.isNew() && !model.isLoaded()) await model.load();
      model.subscribe();

      const html = this.render();
      const template = document.createElement('template');
      template.innerHTML = html;
      const fragment = template.content;

      await this.pre(fragment);

      this.#process(fragment);
      this.attachShadow({mode: 'open'});
      this.shadowRoot.appendChild(fragment);

      await this.post(this.shadowRoot);
    }

    #process (fragment) {
      const model = this.model;
      const propNodes = [];
      const relNodes = [];

      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);

      let node = walker.nextNode();

      while (node) {
        if (node.hasAttribute('property')) propNodes.push(node);
        if (node.hasAttribute('rel')) relNodes.push(node);
        node = walker.nextNode();
      }

      propNodes.forEach((node) => {
        if (!node.hasAttribute('about')) {
          node.setAttribute('about', model.id);
        }
        const tag = node.tagName.toLowerCase();
        if (!node.hasAttribute('is') && !~tag.indexOf('-')) {
          const is = `${tag}-prop-value`;
          const Class = customElements.get(is);
          if (!Class) {
            const Class = PropertyComponent(node.constructor);
            customElements.define(is, Class, {extends: tag});
          }
          const component = document.createElement(tag, {is});
          [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
          component.append(...node.childNodes);
          node.parentNode.replaceChild(component, node);
        }
      });

      relNodes.forEach((node) => {
        if (!node.hasAttribute('about')) {
          node.setAttribute('about', model.id);
        }
        const tag = node.tagName.toLowerCase();
        if (!node.hasAttribute('is') && !~tag.indexOf('-')) {
          const is = `${tag}-rel-value`;
          const Class = customElements.get(is);
          if (!Class) {
            const Class = RelationComponent(node.constructor);
            customElements.define(is, Class, {extends: tag});
          }
          const component = document.createElement(tag, {is});
          [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
          component.append(...node.childNodes);
          node.parentNode.replaceChild(component, node);
        }
      });
    }
  }

  Object.defineProperty(Component, 'name', {value: `Component(${ElementClass.name}, ${ModelClass.name})`});

  return Component;
}
