import Model from '../Model.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';
import { dashToCamel } from '../Util.js';

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

    static toString () {
      return this.tag;
    }

    constructor() {
      super();
      this._eventHandlers = new Map();
    }

    attributeChangedCallback (name, oldValue, newValue) {
      if (oldValue !== newValue) this[dashToCamel(name)] = newValue;
    }

    async connectedCallback () {
      await this.populate();
      const added = this.added();
      if (added instanceof Promise) await added;
      await this.update();
    }

    async disconnectedCallback () {
      for (const [node, handlers] of this._eventHandlers) {
        for (const [eventName, handler] of handlers) {
          node.removeEventListener(eventName, handler);
        }
      }
      this._eventHandlers.clear();

      const removed = this.removed();
      if (removed instanceof Promise) await removed;

      for (const prop in this) {
        if (Object.prototype.hasOwnProperty.call(this, prop)) {
          this[prop] = null;
        }
      }
    }

    model;

    parent;

    template;

    added () {}

    pre (fragment) {}

    render () {
      return this.template ?? this.innerHTML ?? '';
    }

    post (fragment) {}

    removed () {}

    async update () {
      let html = this.render();
      if (html instanceof Promise) html = await html;
      html = typeof html === 'string' ? html.replaceAll(marker, '') : html;
      let template = document.createElement('template');
      template.innerHTML = html;
      let fragment = template.content;

      const pre = this.pre(fragment);
      if (pre instanceof Promise) await pre;

      this.process(fragment);

      const container = this.hasAttribute('shadow')
        ? this.shadowRoot ?? (this.attachShadow({mode: 'open'}), this.shadowRoot)
        : this;
      container.replaceChildren(fragment, template);
      template.remove();

      const post = this.post(fragment);
      if (post instanceof Promise) await post;

      template = null;
      fragment = null;
    }

    async populate () {
      if (!this.model) {
        if (this.hasAttribute('about')) this.model = new ModelClass(this.getAttribute('about'));
      } else {
        this.setAttribute('about', this.model.id);
      }
      if (this.model) {
        if (!this.model.isNew() && !this.model.isLoaded()) await this.model.load();
        this.model.subscribe();
      }
    }

    process (fragment) {
      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

      let node = walker.nextNode();

      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.nodeValue = node.nodeValue.replaceAll(/{{(.*?)}}/gs, (_, e) => this.#evaluate(e));
          node = walker.nextNode();
        } else {
          if (!node.tagName.includes('-') && !node.hasAttribute('is') && !node.hasAttribute('about') && !node.hasAttribute('property') && !node.hasAttribute('rel')) {
            this.#processAttributes(node);
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
          }

          if (isCustom) component = node;

          if (!isCustom) [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));

          component.template = node.innerHTML.trim();

          if (!component.hasAttribute('about') && this.model) {
            component.model = this.model;
          }

          this.#processAttributes(component);

          if (!isCustom) node.parentNode.replaceChild(component, node);

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

    #evaluate (e) {
      const fn = Function('e', `return ${e}`);
      const result = fn.call(this, e);
      fn.prototype = null;
      return result;
    }

    #processAttributes (node) {
      for (const attr of [...node.attributes]) {
        if (attr.name.startsWith('on:')) {
          const eventName = attr.name.slice(3);
          const handler = this.#evaluate(attr.value);
          node.addEventListener(eventName, handler);

          if (!this._eventHandlers.has(node)) {
            this._eventHandlers.set(node, new Map());
          }
          this._eventHandlers.get(node).set(eventName, handler);
        } else {
          attr.nodeValue = attr.nodeValue.replaceAll(/{{(.*?)}}/gs, (_, e) => this.#evaluate(e));
        }
      }
    }

  }

  return ComponentClass;
}
