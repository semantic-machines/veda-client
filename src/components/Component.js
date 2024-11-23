import Model from '../Model.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';
import InlineComponent from './InlineComponent.js';

export function html (strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i] + (values[i] ?? '');
  }
  return result.replace(/\s+/g, ' ').replace(/\s</g, '<').replace(/<!--.*?-->/g, '').trimEnd();
}

export function safe (value) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '\\': '&#x5C;',
    '`': '&#x60;'
  };
  return value.replace(/[&<>"'\/\\`]/g, char => map[char]);
}

export default function Component (ElementClass = HTMLElement, ModelClass = Model) {
  class Component extends ElementClass {
    static name = 'Component';

    static tag = 'veda-component';

    static toString() {
      return this.tag;
    }

    root;

    model;

    parent;

    template;

    added() {}

    pre() {}

    render() {}

    post() {}

    removed() {}

    async update () {
      let html = this.render();
      if (html instanceof Promise) html = await html;
      const template = document.createElement('template');
      template.innerHTML = html;
      const fragment = template.content;

      this.root = fragment;

      const pre = this.pre();
      if (pre instanceof Promise) await pre;

      this.process();

      const container = this.dataset.shadow ?
        this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot) :
        this;
      container.innerHTML = '';
      container.appendChild(fragment);

      this.root = container;

      const post = this.post();
      if (post instanceof Promise) await post;
    }

    async populate () {
      if (!this.model) {
        const about = this.getAttribute('about');
        if (about) {
          this.model = new ModelClass(about);
          if (!this.model.isNew() && !this.model.isLoaded()) await this.model.load();
          this.model.subscribe();
        }
      } else {
        this.setAttribute('about', this.model.id);
        if (!this.model.isNew() && !this.model.isLoaded()) await this.model.load();
        this.model.subscribe();
      }
    }

    async connectedCallback () {
      await this.populate();
      const added = this.added();
      if (added instanceof Promise) await added;
      await this.update();
    }

    async disconnectedCallback () {
      const removed = this.removed();
      if (removed instanceof Promise) await removed;
    }

    process () {
      const fragment = this.root;

      const evaluate = (_, e) => Function('e', `return ${e}`).call(this, e);

      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

      let node = walker.nextNode();

      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.nodeValue = node.nodeValue.replaceAll(/{{(.*?)}}/gs, evaluate);
        } else {
          for (const attr of node.attributes) {
            if (attr.name.startsWith('@')) {
              const eventName = attr.name.slice(1);
              const handler = evaluate(null, attr.value);
              node.addEventListener(eventName, handler);
            } else {
              attr.nodeValue = attr.nodeValue.replaceAll(/{{(.*?)}}/gs, evaluate);
            }
          }
          if (node.hasAttribute('about') && !node.hasAttribute('property') && !node.hasAttribute('rel')) {
            const tag = node.tagName.toLowerCase();
            if (!node.hasAttribute('is') && !~tag.indexOf('-')) {
              const is = `${tag}-inline-component`;
              const Class = customElements.get(is);
              if (!Class) {
                const Class = InlineComponent(node.constructor);
                customElements.define(is, Class, {extends: tag});
              }
              const component = document.createElement(tag, {is});
              [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
              component.template = node.innerHTML;
              component.parent = this;
              node.parentNode.replaceChild(component, node);
              walker.currentNode = component;
            }
          }
          if (node.hasAttribute('property') || node.hasAttribute('rel')) {
            const ClassFactory = node.hasAttribute('property') ? PropertyComponent : RelationComponent;
            const suffix = ClassFactory === PropertyComponent ? 'property-component' : 'relation-component';
            const tag = node.tagName.toLowerCase();
            if (!node.hasAttribute('is') && !~tag.indexOf('-')) {
              const is = `${tag}-${suffix}`;
              const Class = customElements.get(is);
              if (!Class) {
                const Class = ClassFactory(node.constructor);
                customElements.define(is, Class, {extends: tag});
              }
              const component = document.createElement(tag, {is});
              [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
              component.template = node.innerHTML.trim();
              if (!component.hasAttribute('about') && this.model) {
                component.model = this.model;
              }
              component.parent = this;
              node.parentNode.replaceChild(component, node);
              walker.currentNode = component;
            }
          }
        }
        node = walker.nextNode();
      }
    }
  }

  return Component;
}
