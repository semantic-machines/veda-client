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
    constructor () {
      super();
      this.created();
    }

    model;

    created () {}

    added () {}

    pre (root) {}

    render () {}

    post (root) {}

    removed () {}

    async populate () {
      if (!this.model) {
        const about = this.getAttribute('about');
        this.model = about ? new Model(about) : new Model();
      }
      if (!this.model.isNew() && !this.model.isLoaded()) await this.model.load();
      this.model.subscribe();
    }

    async connectedCallback () {
      await this.added();
      await this.populate();

      const html = this.render();
      const template = document.createElement('template');
      template.innerHTML = html;
      const fragment = template.content;

      await this.pre(fragment);

      this.process(fragment);

      if (this.shadow) {
        this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(fragment);
        await this.post(this.shadowRoot);
      } else {
        this.appendChild(fragment);
        await this.post(this);
      }
    }

    async disconnectedCallback () {
      await this.removed();
    }

    process (fragment) {
      const model = this.model;

      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);

      let node = walker.nextNode();

      while (node) {
        if (node.hasAttribute('property')) {
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
            component.template = node.innerHTML;
            if (!component.hasAttribute('about')) {
              component.model = model;
              component.setAttribute('about', model.id);
            }
            node.parentNode.replaceChild(component, node);
            walker.currentNode = component;
          }
        }
        if (node.hasAttribute('rel')) {
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
            component.template = node.innerHTML;
            if (!component.hasAttribute('about')) {
              component.model = model;
              component.setAttribute('about', model.id);
            }
            node.parentNode.replaceChild(component, node);
            walker.currentNode = component;
          }
        }
        node = walker.nextNode();
      }
    }
  }

  Object.defineProperty(Component, 'name', {value: `Component(${ElementClass.name}, ${ModelClass.name})`});

  return Component;
}
