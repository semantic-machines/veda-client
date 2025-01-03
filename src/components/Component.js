import Model from '../Model.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';

const marker = Date.now();
const re = new RegExp(`^${marker}`);

export function html (strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    let value = values[i] ?? '';
    if (Array.isArray(value)) {
      value = value.map(v => re.test(v) ? v : safe(v)).join(' ');
    } else {
      value = re.test(value) ? value : safe(value);
    }
    result += strings[i] + value;
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

    model;

    template;

    added () {}

    pre () {}

    render () {
      return this.template ?? this.innerHTML ?? '';
    }

    post () {}

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
      container.replaceChildren(fragment);

      const post = this.post(fragment);
      if (post instanceof Promise) await post;

      template.remove();
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
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
          }

          // Property/Relation component
          if (!isCustom && (node.hasAttribute('property') || node.hasAttribute('rel'))) {
            const type = node.hasAttribute('property') ? 'property' : 'rel';
            const is = `${tag}-${type}-component`;
            const Class = customElements.get(is);
            if (!Class) {
              const Class = (type === 'property' ? PropertyComponent : RelationComponent)(node.constructor);
              customElements.define(is, Class, {extends: tag});
            }
            component = document.createElement(tag, {is});
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
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
          }

          // Customized built-in component
          if (node.hasAttribute('is')) {
            const is = node.getAttribute('is');
            const Class = customElements.get(is);
            if (!Class) throw Error(`Custom elements registry has no entry for tag '${tag}'`);
            component = document.createElement(tag, {is});
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
          }

          component.template = node.innerHTML.trim();

          this.#processAttributes(component);

          node.parentNode.replaceChild(component, node);

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
      return Function(`return ${e}`).call(this);
    }

    #processAttributes (node) {
      for (const attr of [...node.attributes]) {
        if (attr.name.startsWith('on:')) {
          const eventName = attr.name.slice(3);
          const handler = this.#evaluate(attr.value);
          node.addEventListener(eventName, handler);
        } else {
          attr.nodeValue = attr.nodeValue.replaceAll(/{{(.*?)}}/gs, (_, e) => this.#evaluate(e));
        }
      }
    }

  }

  return ComponentClass;
}
