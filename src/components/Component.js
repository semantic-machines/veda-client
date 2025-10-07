import Model from '../Model.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';
import ExpressionParser from './ExpressionParser.js';

const marker = Date.now();
const re = new RegExp(`^${marker}`);

export function raw (strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    let value = values[i] ?? '';
    if (Array.isArray(value)) {
      value = value.join(' ');
    }
    result += strings[i] + value;
  }
  return marker + result.trimEnd();
}

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
  return class ComponentClass extends ElementClass {
    static tag = 'veda-component';

    static toString () {
      return this.tag;
    }

    #resolveRendered;
    #childrenRendered = [];
    async #setRendered() {
      await Promise.all(this.#childrenRendered);
      this.#resolveRendered?.();
      this.renderedCallback();
    }

    constructor() {
      super();
      this.rendered = new Promise((resolve) => {
        this.#resolveRendered = resolve;
      });
    }

    renderedCallback () {}

    async connectedCallback () {
      try {
        await this.populate();
        const added = this.added();
        if (added instanceof Promise) await added;
        await this.update();
      } catch (error) {
        console.log(this, 'Component render error', error);
      } finally {
        this.#setRendered();
      }
    }

    async disconnectedCallback () {
      try {
        const removed = this.removed();
        if (removed instanceof Promise) await removed;
      } catch (error) {
        console.log(this, 'Component remove error', error);
      } finally {
        this.#setRendered();
      }
    }

    model;

    template;

    added () {}

    pre () {}

    render () {
      return this.template ?? this.innerHTML;
    }

    post () {}

    removed () {}

    async update () {
      const pre = this.pre();
      if (pre instanceof Promise) await pre;

      let html = this.render();
      if (html instanceof Promise) html = await html;

      if (typeof html === 'undefined') {
        const post = this.post();
        if (post instanceof Promise) await post;
        return;
      }

      html = typeof html === 'string' ? html.replaceAll(marker, '') : html;
      let template = document.createElement('template');
      template.innerHTML = html;
      let fragment = template.content;

      this._process(fragment);

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
      } else if (this.model.id) {
        this.setAttribute('about', this.model.id);
      }
      if (this.model) {
        await this.model.load?.();
        this.model.subscribe?.();
      }
    }

    _process (fragment) {
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
            component.setAttribute('is', is); // Explicitly set 'is' attribute for findMethod
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
            component.setAttribute('is', is); // Explicitly set 'is' attribute for findMethod
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
            component.setAttribute('is', is); // Explicitly set 'is' attribute for findMethod
            [...node.attributes].forEach((attr) => component.setAttribute(attr.nodeName, attr.nodeValue));
          }

          component.template = node.innerHTML.trim();

          this.#processAttributes(component);

          node.parentNode.replaceChild(component, node);

          this.#childrenRendered.push(component.rendered);

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
      try {
        return ExpressionParser.evaluate(e, this);
      } catch (error) {
        console.warn(`Invalid expression '${e}':`, error.message);
        return '';
      }
    }

    #findMethod (name) {
      // Search for method in current component
      if (typeof this[name] === 'function') {
        return this[name];
      }

      // Search up the component tree via parentElement and shadow DOM hosts
      // Start with parentElement if available, otherwise try shadow host
      let parent = this.parentElement || this.getRootNode?.()?.host;
      let depth = 0;
      while (parent && depth < 20) {
        depth++;
        const isComponent = parent.tagName?.includes('-') || parent.hasAttribute('is');
        if (isComponent && typeof parent[name] === 'function') {
          return parent[name];
        }

        // Try to go up: first try parentElement, if null try shadow host
        parent = parent.parentElement || parent.getRootNode?.()?.host;
      }

      console.warn(`Method '${name}' not found in component tree`);
      return null;
    }

    #processAttributes (node) {
      for (const attr of [...node.attributes]) {
        // Handle event attributes with {{ }} syntax
        if (attr.name.startsWith('on') && attr.name.length > 2 && attr.value.includes('{{')) {
          const eventName = attr.name.slice(2).toLowerCase(); // onclick -> click
          const expr = attr.value.replace(/{{|}}/g, '').trim();

          // Remove attribute to prevent browser's default eval behavior
          node.removeAttribute(attr.name);

          try {
            // Try to evaluate as expression first
            const result = ExpressionParser.evaluate(expr, this, true); // preserveContext = true

            if (result && typeof result.value === 'function') {
              // Expression resolved to function with context
              node.addEventListener(eventName, (e) => {
                result.value.call(result.context, e, node);
              });
            } else if (typeof result === 'function') {
              // Expression resolved to simple function
              node.addEventListener(eventName, (e) => {
                result.call(this, e, node);
              });
            } else if (/^\w+$/.test(expr)) {
              // Simple method name - search up component tree lazily on event
              node.addEventListener(eventName, (e) => {
                const method = this.#findMethod(expr);
                if (method) {
                  method.call(this, e, node);
                } else {
                  console.warn(`Method '${expr}' not found in component tree`);
                }
              });
            } else {
              console.warn(`Handler expression '${expr}' did not resolve to a function`);
            }
          } catch (error) {
            console.warn(`Invalid event handler expression '${expr}':`, error.message);
          }
        }
        // Handle regular attributes with {{ }} interpolation
        else if (attr.value && attr.value.includes('{{')) {
          attr.nodeValue = attr.nodeValue.replaceAll(/{{(.*?)}}/gs, (_, e) => this.#evaluate(e));
        }
      }
    }
  }
}
