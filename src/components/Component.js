import Model from '../Model.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';
import {reactive} from '../Reactive.js';

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
  return value.replace(/[&<>"'/\\`]/g, char => map[char]).replace(/\{.*?\}/g, '');
}

export default function Component (ElementClass = HTMLElement, ModelClass = Model) {
  return class ComponentClass extends ElementClass {
    static tag = 'veda-component';

    static toString () {
      return this.tag;
    }

  #resolveRendered;
  #childrenRendered = [];
  #effects = []; // User-created effects via watch()
  #renderEffects = []; // Auto-created effects for {expressions}
  #isReactive = false; // Tracks if component uses reactive state

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
        // DevTools integration
        if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
          window.__VEDA_DEVTOOLS_HOOK__.trackComponent(this);
        }

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
      // DevTools integration: untrack component
      if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
        window.__VEDA_DEVTOOLS_HOOK__.untrackComponent(this);
      }

      // Cleanup reactive effects
      this.#cleanupEffects();

      // Note: model.subscribe() called for backend push notifications,
      // but local reactivity is handled via effect() - no model.on('modified') needed

      const removed = this.removed();
      if (removed instanceof Promise) await removed;
    } catch (error) {
      console.log(this, 'Component remove error', error);
    } finally {
      this.#setRendered();
    }
  }

    /**
     * Clean up all effects
     */
    #cleanupEffects() {
      this.#effects.forEach(cleanup => cleanup());
      this.#effects = [];
      this.#renderEffects.forEach(cleanup => cleanup());
      this.#renderEffects = [];
    }

    model;

    // Internal field for storing innerHTML of child components
    template;

    added () {}

    pre () {}

    render () {
      return this.template ?? this.innerHTML;
    }

    post () {}

    removed () {}

    async update () {
      try {
        // Clear old child promises to prevent memory leak
        this.#childrenRendered = [];

        // Clear old render effects
        this.#renderEffects.forEach(cleanup => cleanup());
        this.#renderEffects = [];

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
      } catch (error) {
        console.log(this, 'Component render error', error);
      }
    }

    async populate () {
      // Auto-detect reactive state (check here, not in constructor)
      if (!this.#isReactive && this.state && this.state.__isReactive) {
        this.#isReactive = true;
      }

      if (!this.model) {
        if (this.hasAttribute('about')) this.model = new ModelClass(this.getAttribute('about'));
      } else if (this.model.id) {
        this.setAttribute('about', this.model.id);
      }
      if (this.model) {
        await this.model.load?.();
        this.model.subscribe?.();

        // Fine-grained reactivity is handled by effect() in:
        // - ValueComponent/PropertyComponent/RelationComponent (property/rel attributes)
        // - Reactive attributes (checked="{...}", etc)
        // - Computed properties accessed in render
        // No need for coarse-grained model.on('modified') subscription
      }
    }

  /**
   * Process text node for reactive expressions {expr}
   */
  #processTextNode(textNode) {
      // Skip text nodes inside <style> and <script> tags
      const parent = textNode.parentNode;
      if (parent && (parent.tagName === 'STYLE' || parent.tagName === 'SCRIPT')) {
        return;
      }

      const text = textNode.nodeValue;
      const regex = /\{([^}]+)\}/g;

      // Check if text contains expressions
      if (!regex.test(text)) {
        return;
      }

      regex.lastIndex = 0; // Reset regex

      // Parse text into parts: static text and expressions
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        // Add static text before expression
        if (match.index > lastIndex) {
          parts.push({
            type: 'static',
            value: text.substring(lastIndex, match.index)
          });
        }

        // Add expression
        parts.push({
          type: 'expression',
          code: match[1].trim()
        });

        lastIndex = regex.lastIndex;
      }

      // Add remaining static text
      if (lastIndex < text.length) {
        parts.push({
          type: 'static',
          value: text.substring(lastIndex)
        });
      }

      // If reactive component, create effects for expressions
      if (this.#isReactive) {
        const parent = textNode.parentNode;
        const evalContext = this._currentEvalContext || this;

        // Create nodes for each part
        const nodes = parts.map(part => {
          if (part.type === 'static') {
            return document.createTextNode(part.value);
          } else {
            // Create text node for expression
            const node = document.createTextNode('');

            // Create effect to update this text node
            // Capture evalContext in closure
            const cleanup = effect(() => {
              const value = ExpressionParser.evaluate(part.code, evalContext);
              node.nodeValue = value != null ? String(value) : '';
            });

            this.#renderEffects.push(cleanup);
            return node;
          }
        });

        // Replace textNode content with empty string (keep the node for walker)
        textNode.nodeValue = '';

        // Insert new nodes after the (now empty) textNode in correct order
        let insertAfter = textNode;
        nodes.forEach(node => {
          parent.insertBefore(node, insertAfter.nextSibling);
          insertAfter = node;
        });
      } else {
        // Non-reactive: just evaluate once
        textNode.nodeValue = text.replace(/\{([^}]+)\}/g, (_, code) => {
          const value = this.#evaluate(code.trim());
          return value != null ? String(value) : '';
        });
      }
    }

    _process (fragment, evalContext = null) {
      // Auto-detect reactive state before processing
      if (!this.#isReactive && this.state && this.state.__isReactive) {
        this.#isReactive = true;
      }

      // Store eval context for this processing session
      const previousContext = this._currentEvalContext;
      this._currentEvalContext = evalContext || this;

      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

      let node = walker.nextNode();

      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          // Process reactive expressions in text nodes
          this.#processTextNode(node);
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
            if (!component.hasAttribute('about')) {
              // Use evalContext.model if available, otherwise fall back to this.model
              const contextModel = (this._currentEvalContext && this._currentEvalContext.model) || this.model;
              if (contextModel) {
                component.model = contextModel;
              }
            }
          }

          // Custom component
          if (tag.includes('-')) {
            const Class = customElements.get(tag);
            if (!Class) throw Error(`Custom elements registry has no entry for tag '${tag}'`);
            component = document.createElement(tag);
            // Copy attributes but preserve original values (not evaluated)
            [...node.attributes].forEach((attr) => {
              const originalValue = node.getAttribute(attr.nodeName);
              component.setAttribute(attr.nodeName, originalValue);
            });
          }

          // Customized built-in component
          if (node.hasAttribute('is')) {
            const is = node.getAttribute('is');
            const Class = customElements.get(is);
            if (!Class) throw Error(`Custom elements registry has no entry for tag '${tag}'`);
            component = document.createElement(tag, {is});
            component.setAttribute('is', is); // Explicitly set 'is' attribute for findMethod
            // Copy attributes but preserve original values (not evaluated)
            [...node.attributes].forEach((attr) => {
              if (attr.nodeName !== 'is') {
                const originalValue = node.getAttribute(attr.nodeName);
                component.setAttribute(attr.nodeName, originalValue);
              }
            });
          }

          // Store original innerHTML for components that need it (Loop, If)
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

      // Restore previous eval context
      this._currentEvalContext = previousContext;
    }

    #evaluate (e, fromNode = null) {
      // Use stored eval context if available, otherwise use this
      const context = this._currentEvalContext || this;

      try {
        return ExpressionParser.evaluate(e, context);
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
      // Process reactive attributes for custom components
      if (node.tagName && (node.tagName.includes('-') || node.hasAttribute('is'))) {
        const tagName = node.tagName.toLowerCase();
        const isFrameworkComponent = tagName === 'veda-if' || tagName === 'veda-loop';

        // Framework components handle their own special attributes
        const frameworkAttrs = isFrameworkComponent ? ['condition', 'items', 'item-key'] : [];

        // For custom components, process attributes with {} expressions
        for (const attr of [...node.attributes]) {
          // Skip framework-specific attributes
          if (frameworkAttrs.includes(attr.name)) {
            continue;
          }

          if (attr.value && attr.value.includes('{')) {
            const attrName = attr.nodeName;
            const template = attr.nodeValue;

            // Use evalContext to check reactivity (for veda-if/veda-loop contexts)
            const contextForReactivity = this._currentEvalContext || this;
            const isReactive = contextForReactivity.state?.__isReactive || false;

            // Create effect to update the attribute
            if (isReactive && /\{([^}]+)\}/g.test(template)) {
              // Capture evalContext for the effect closure
              const evalContext = this._currentEvalContext || this;
              const cleanup = effect(() => {
                const value = template.replace(/\{([^}]+)\}/g, (_, code) => {
                  // Use captured evalContext for evaluation
                  return ExpressionParser.evaluate(code.trim(), evalContext) ?? '';
                });
                // Only update if value changed to prevent unnecessary updates
                if (node.getAttribute(attrName) !== value) {
                  node.setAttribute(attrName, value);
                }
              });
              this.#renderEffects.push(cleanup);
            } else {
              // Non-reactive: evaluate once
              const value = template.replace(/\{([^}]+)\}/g, (_, code) => {
                return this.#evaluate(code.trim(), node) ?? '';
              });
              attr.nodeValue = value;
            }
          }
        }
        // Don't process other attributes for custom components
        return;
      }

      for (const attr of [...node.attributes]) {
        // Handle event attributes with { } syntax
        if (attr.name.startsWith('on') && attr.name.length > 2 && attr.value.includes('{')) {
          const eventName = attr.name.slice(2).toLowerCase(); // onclick -> click
          const expr = attr.value.replace(/[{}]/g, '').trim();

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
        // Handle regular attributes with { } interpolation
        else if (attr.value && attr.value.includes('{')) {
          const attrName = attr.nodeName;
          const template = attr.nodeValue;

          // Boolean attributes that should be set as properties for proper DOM behavior
          const booleanProps = {
            'checked': 'checked',
            'disabled': 'disabled',
            'selected': 'selected',
            'readonly': 'readOnly',
            'required': 'required',
            'multiple': 'multiple',
            'hidden': 'hidden'
          };
          const propName = booleanProps[attrName];

          // Use evalContext to check reactivity (for veda-if/veda-loop contexts)
          const contextForReactivity = this._currentEvalContext || this;
          const isReactive = contextForReactivity.state?.__isReactive || false;

          // If reactive component, create effect for this attribute
          if (isReactive && /\{([^}]+)\}/g.test(template)) {
            // Remove attribute initially to prevent it from being evaluated by browser
            node.removeAttribute(attrName);

            // Capture evalContext for the effect closure
            const evalContext = this._currentEvalContext || this;
            const cleanup = effect(() => {
              let hasUndefinedOrNull = false;
              const value = template.replace(/\{([^}]+)\}/g, (_, code) => {
                // Use ExpressionParser for simple expressions
                const rawValue = ExpressionParser.evaluate(code.trim(), evalContext);
                // Track if any expression returned null/undefined
                if (rawValue === null || rawValue === undefined) {
                  hasUndefinedOrNull = true;
                }
                return rawValue ?? '';
              });

              if (propName) {
                // For boolean properties, set both property and attribute
                // Boolean attributes should be false for: false, null, undefined, 'false'
                // And true for: true, 'true', '', attribute name, non-empty strings
                const boolValue = !hasUndefinedOrNull &&
                                  value !== 'false' &&
                                  (value === 'true' || value === '' || value === attrName);
                if (node[propName] !== boolValue) {
                  node[propName] = boolValue;
                  node.toggleAttribute(attrName, boolValue);
                }
              } else {
                // Only update if value changed
                if (node.getAttribute(attrName) !== value) {
                  node.setAttribute(attrName, value);
                }
              }
            });

            this.#renderEffects.push(cleanup);
          } else {
            // Non-reactive: evaluate once
            let hasUndefinedOrNull = false;
            const value = template.replace(/\{([^}]+)\}/g, (_, code) => {
              const rawValue = this.#evaluate(code.trim());
              // Track if any expression returned null/undefined
              if (rawValue === null || rawValue === undefined) {
                hasUndefinedOrNull = true;
              }
              return rawValue ?? '';
            });

            if (propName) {
              // Boolean attributes should be false for: false, null, undefined, 'false'
              // And true for: true, 'true', '', attribute name, non-empty strings
              const boolValue = !hasUndefinedOrNull &&
                                value !== 'false' &&
                                (value === 'true' || value === '' || value === attrName);
              node[propName] = boolValue;
              node.toggleAttribute(attrName, boolValue);
            } else {
              attr.nodeValue = value;
            }
          }
        }
      }
    }

    /**
     * Helper: create reactive state (call in constructor)
     */
    reactive(obj) {
      this.#isReactive = true;

      // DevTools integration: track state changes
      const reactiveObj = reactive(obj, {
        onSet: (key, value, oldValue) => {
          if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
            window.__VEDA_DEVTOOLS_HOOK__.trackComponentStateChange(this);
          }
        }
      });

      return reactiveObj;
    }

    /**
     * Helper: create an effect
     */
    effect(fn) {
      const cleanup = effect(fn);
      this.#effects.push(cleanup);
      return cleanup;
    }

  /**
   * Helper: watch a value and run callback when it changes
   *
   * NOTE: Uses reference equality (===) for comparison.
   * For objects/arrays, callback will only trigger if the reference changes,
   * not when properties inside are modified.
   *
   * Examples:
   *   this.watch(() => state.count, (val) => ...);  // Triggers on count change
   *   this.watch(() => state.items, (val) => ...);  // Only triggers if items = newArray
   *   state.items.push(x);  // Won't trigger (same reference)
   *   state.items = [...state.items, x];  // Triggers (new reference)
   *
   * WORKAROUNDS for arrays/objects:
   *   1. Watch specific property: this.watch(() => state.items.length, ...)
   *   2. Watch nested property: this.watch(() => state.user.name, ...)
   *   3. Reassign after mutation: state.items.push(x); state.items = state.items.slice();
   *
   * @param {Function} getter - Function that returns the value to watch
   * @param {Function} callback - Callback to run when value changes
   * @param {Object} options - Options { immediate: true } to run callback immediately
   */
  watch(getter, callback, options = {}) {
      let oldValue;
      let isFirst = true;

      const cleanup = effect(() => {
        const newValue = getter();
        if (isFirst) {
          isFirst = false;
          oldValue = newValue;
          // Run callback immediately on first run if immediate option is true
          if (options.immediate) {
            callback(newValue, undefined);
          }
        } else if (newValue !== oldValue) {
          callback(newValue, oldValue);
          oldValue = newValue;
        }
      });

      this.#effects.push(cleanup);
      return cleanup;
    }
  }
}

export {reactive, effect};
