import Model from '../Model.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';

const marker = Date.now();
const re = new RegExp(`^${marker}`);

export function html (strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    let value = values[i] ?? '';
    result += strings[i] + (re.test(value) ? value : safe(value));
  }
  return marker + result.trimEnd();
}

export function safe (value) {
  if (Array.isArray(value)) return value.map(safe);
  if (typeof value !== 'string' && !(value instanceof String)) return value;
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '\\': '&#x5C;',
    '`': '&#x60;',
  };
  return value.replace(/[&<>"'/\\`]/g, char => map[char]).replace(/{{.*?}}/g, '');
}

export default function Component (ElementClass = HTMLElement, ModelClass = Model) {
  class ComponentClass extends ElementClass {
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

    render() {
      return this.template ?? this.innerHTML ?? '';
    }

    post() {}

    removed() {}

    async update () {
      let html = this.render();
      if (html instanceof Promise) html = await html;
      html = typeof html === 'string' ? html.replaceAll(marker, '') : html;
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
          node = walker.nextNode();
        } else {
          for (const attr of [...node.attributes]) {
            if (attr.name.startsWith('@')) {
              const eventName = attr.name.slice(1);
              const handler = evaluate(null, attr.value);
              node.addEventListener(eventName, handler);
              node.removeAttribute(attr.name);
              node.setAttribute(`at-${eventName}`, handler);
            } else {
              attr.nodeValue = attr.nodeValue.replaceAll(/{{(.*?)}}/gs, evaluate);
            }
          }

          if (!node.tagName.includes('-') && !node.hasAttribute('is') && !node.hasAttribute('about') && !node.hasAttribute('property') && !node.hasAttribute('rel')) {
            node = walker.nextNode();
            continue;
          }

          const tag = node.tagName.toLowerCase();
          const isCustom = tag.includes('-') || node.hasAttribute('is');

          let component;

          // Inline component
          if (!isCustom && node.hasAttribute('about') && !node.hasAttribute('property') && !node.hasAttribute('rel')) {
            const is = `${tag}-inline-component`;
            const Class = customElements.get(is);
            if (!Class) {
              const Class = Component(node.constructor);
              customElements.define(is, Class, {extends: tag});
            }
            component = document.createElement(tag, {is});
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
            component.template = node.innerHTML.trim();
          }

          // Property component
          if (!isCustom && node.hasAttribute('property')) {
            const is = `${tag}-property-component`;
            const Class = customElements.get(is);
            if (!Class) {
              const Class = PropertyComponent(node.constructor);
              customElements.define(is, Class, {extends: tag});
            }
            component = document.createElement(tag, {is});
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
            component.template = node.innerHTML.trim();
            if (!component.hasAttribute('about') && this.model) {
              component.model = this.model;
            }
          }

          // Relation component
          if (!isCustom && node.hasAttribute('rel')) {
            const is = `${tag}-relation-component`
            const Class = customElements.get(is);
            if (!Class) {
              const Class = RelationComponent(node.constructor);
              customElements.define(is, Class, {extends: tag});
            }
            component = document.createElement(tag, {is});
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
            component.template = node.innerHTML.trim();
            if (!component.hasAttribute('about') && this.model) {
              component.model = this.model;
            }
          }

          // Custom component
          if (tag.includes('-')) {
            const Class = customElements.get(tag);
            if (!Class) throw Error(`Custom elements registry has no entry for tag '${tag}'`);
            component = document.createElement(tag);
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
            component.template = node.innerHTML.trim();
          }

          // Customized standard component
          if (node.hasAttribute('is')) {
            const is = node.getAttribute('is');
            const Class = customElements.get(is);
            if (!Class) throw Error(`Custom elements registry has no entry for tag '${tag}'`);
            component = document.createElement(tag, {is});
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
            component.template = node.innerHTML.trim();
          }

          node.parentNode.replaceChild(component, node);
          component.parent = this;

          walker.currentNode = component;

          // Find next node to process
          let nextNode = null;

          // First check next sibling node
          if (component.nextSibling) {
            walker.currentNode = component.nextSibling;
            nextNode = component.nextSibling;
          } else {
            // If no next sibling, traverse up the tree
            let parent = component.parentNode;
            while (parent && parent.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
              if (parent.nextSibling) {
                walker.currentNode = parent.nextSibling;
                nextNode = parent.nextSibling;
                break;
              }
              parent = parent.parentNode;
            }
          }
          node = nextNode;
        }
      }
    }
  }

  return ComponentClass;
}
