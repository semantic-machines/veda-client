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
  #eventListeners = []; // Event listeners to cleanup on disconnect
  #isReactive = false; // Tracks if component uses reactive state

    async #setRendered() {
      await Promise.all(this.#childrenRendered);
      this.#resolveRendered?.();
      this.renderedCallback();
    }

    constructor() {
      super();
      // Auto-create reactive state for all components with DevTools integration
      // Use WeakRef to avoid preventing GC of component
      const componentRef = new WeakRef(this);
      this.state = reactive({}, {
        onSet: (key, value, oldValue) => {
          if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
            const component = componentRef.deref();
            if (component) {
              window.__VEDA_DEVTOOLS_HOOK__.trackComponentStateChange(component);
            }
          }
        }
      });
      this.#isReactive = true;

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

      // Cleanup reactive effects and event listeners
      this.#cleanupEffects();
      this.#cleanupEventListeners();

      // Clear state to release any model references
      if (this.state) {
        for (const key of Object.keys(this.state)) {
          this.state[key] = null;
        }
      }

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

    /**
     * Clean up all event listeners
     */
    #cleanupEventListeners() {
      this.#eventListeners.forEach(({ node, eventName, handler }) => {
        node.removeEventListener(eventName, handler);
      });
      this.#eventListeners = [];
    }

    /**
     * Public method for external cleanup (used by If/Loop components)
     */
    _cleanupAllEventListeners() {
      this.#cleanupEventListeners();
    }

    /**
     * Get current count of render effects (for Loop component)
     */
    _getRenderEffectsCount() {
      return this.#renderEffects.length;
    }

    /**
     * Extract render effects added after startIndex (for Loop component)
     */
    _extractRenderEffects(startIndex) {
      const extracted = this.#renderEffects.splice(startIndex);
      return extracted;
    }

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
      // Handle 'about' attribute - auto-populate this.state.model
      if (this.hasAttribute('about')) {
        const uri = this.getAttribute('about');
        if (!this.state.model || this.state.model.id !== uri) {
          this.state.model = new ModelClass(uri);
        }
      } else if (this.state.model && this.state.model.id) {
        // If model exists in state, sync about attribute
        this.setAttribute('about', this.state.model.id);
      }

      // Load and subscribe to model if it exists
      if (this.state.model) {
        try {
          await this.state.model.load?.();
        } catch {
          // Backend may not be configured (e.g., in tests) - ignore
        }
        this.state.model.subscribe?.();
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
      // Store eval context for this processing session
      const previousContext = this._currentEvalContext;

      // If no explicit evalContext provided, use this.state with prototype to this
      if (!evalContext) {
        evalContext = this.state;
        // Set prototype chain: evalContext -> this (for methods)
        if (evalContext && typeof evalContext === 'object') {
          Object.setPrototypeOf(evalContext, this);
        }
      }

      this._currentEvalContext = evalContext;

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
              // Use evalContext.model if available, otherwise fall back to this.state.model
              const contextModel = (this._currentEvalContext && this._currentEvalContext.model) || this.state.model;
              if (contextModel) {
                component.state.model = contextModel;
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
        return { method: this[name], context: this };
      }

      // Search up the component tree via parentElement and shadow DOM hosts
      // Start with parentElement if available, otherwise try shadow host
      let parent = this.parentElement || this.getRootNode?.()?.host;
      let depth = 0;
      while (parent && depth < 20) {
        depth++;
        const isComponent = parent.tagName?.includes('-') || parent.hasAttribute('is');
        if (isComponent && typeof parent[name] === 'function') {
          return { method: parent[name], context: parent };
        }

        // Try to go up: first try parentElement, if null try shadow host
        parent = parent.parentElement || parent.getRootNode?.()?.host;
      }

      console.warn(`Method '${name}' not found in component tree`);
      return null;
    }

    #processAttributes (node) {
      if (node.tagName && (node.tagName.includes('-') || node.hasAttribute('is'))) {
        this.#processCustomComponentAttributes(node);
        return;
      }

      this.#processNativeElementAttributes(node);
    }

    #processCustomComponentAttributes(node) {
      const tagName = node.tagName.toLowerCase();
      const isFrameworkComponent = tagName === 'veda-if' || tagName === 'veda-loop';
      const frameworkAttrs = isFrameworkComponent ? ['condition', 'items', 'as', 'key', 'item-key'] : [];

      for (const attr of [...node.attributes]) {
        const attrName = attr.nodeName;

        if (attrName.startsWith(':')) {
          this.#processPropertyBinding(node, attr);
          continue;
        }

        if (frameworkAttrs.includes(attr.name)) {
          continue;
        }

        if (attr.value?.includes('{')) {
          this.#processAttributeExpression(node, attr);
        }
      }
    }

    #processPropertyBinding(node, attr) {
      const attrName = attr.nodeName;
      const propName = attrName.slice(1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const expression = attr.nodeValue;

      node.removeAttribute(attrName);

      const evalContext = this._currentEvalContext || this;

      if (this.#isReactive && expression.includes('{')) {
        const cleanup = effect(() => {
          const pureExprMatch = expression.match(/^\{(.+)\}$/);
          const value = pureExprMatch
            ? ExpressionParser.evaluate(pureExprMatch[1].trim(), evalContext)
            : expression.replace(/\{([^}]+)\}/g, (_, code) =>
                ExpressionParser.evaluate(code.trim(), evalContext));

          const target = node.state || node;
          target[propName] = value;
        });
        this.#renderEffects.push(cleanup);
      } else {
        const value = expression.replace(/\{([^}]+)\}/g, (_, code) =>
          this.#evaluate(code.trim(), node));

        const target = node.state || node;
        target[propName] = value;
      }
    }

    #processAttributeExpression(node, attr) {
      const attrName = attr.nodeName;
      const template = attr.nodeValue;
      const contextForReactivity = this._currentEvalContext || this;
      const isReactive = contextForReactivity.__isReactive || contextForReactivity.state?.__isReactive || false;

      if (isReactive && /\{([^}]+)\}/g.test(template)) {
        const evalContext = this._currentEvalContext || this;
        const cleanup = effect(() => {
          const value = template.replace(/\{([^}]+)\}/g, (_, code) =>
            ExpressionParser.evaluate(code.trim(), evalContext) ?? '');

          if (node.getAttribute(attrName) !== value) {
            node.setAttribute(attrName, value);
          }
        });
        this.#renderEffects.push(cleanup);
      } else {
        const value = template.replace(/\{([^}]+)\}/g, (_, code) =>
          this.#evaluate(code.trim(), node) ?? '');
        attr.nodeValue = value;
      }
    }

    #processNativeElementAttributes(node) {
      for (const attr of [...node.attributes]) {
        if (attr.name.startsWith('on') && attr.name.length > 2 && attr.value.includes('{')) {
          this.#processEventAttribute(node, attr);
        } else if (attr.value?.includes('{')) {
          this.#processRegularAttribute(node, attr);
        }
      }
    }

    #processEventAttribute(node, attr) {
      const eventName = attr.name.slice(2).toLowerCase();
      const expr = attr.value.replace(/[{}]/g, '').trim();

      node.removeAttribute(attr.name);

      try {
        const result = ExpressionParser.evaluate(expr, this, true);

        if (result && typeof result.value === 'function') {
          const handler = (e) => {
            result.value.call(result.context, e, node);
          };
          node.addEventListener(eventName, handler);
          this.#eventListeners.push({ node, eventName, handler });
        } else if (/^\w+$/.test(expr)) {
          const handler = (e) => {
            const found = this.#findMethod(expr);
            if (found) {
              found.method.call(found.context, e, node);
            } else {
              console.warn(`Method '${expr}' not found in component tree`);
            }
          };
          node.addEventListener(eventName, handler);
          this.#eventListeners.push({ node, eventName, handler });
        } else {
          console.warn(`Handler expression '${expr}' did not resolve to a function`);
        }
      } catch (error) {
        console.warn(`Invalid event handler expression '${expr}':`, error.message);
      }
    }

    #processRegularAttribute(node, attr) {
      const attrName = attr.nodeName;
      const template = attr.nodeValue;

      const contextForReactivity = this._currentEvalContext || this;
      const isReactive = contextForReactivity.__isReactive || contextForReactivity.state?.__isReactive || false;

      if (isReactive && /\{([^}]+)\}/g.test(template)) {
        node.removeAttribute(attrName);

        const evalContext = this._currentEvalContext || this;
        const cleanup = effect(() => {
          const { value, hasNull } = this.#evaluateTemplate(template, evalContext);
          this.#setAttributeOrProperty(node, attrName, value, hasNull);
        });
        this.#renderEffects.push(cleanup);
      } else {
        const { value, hasNull } = this.#evaluateTemplate(template, this);
        this.#setAttributeOrProperty(node, attrName, value, hasNull, attr);
      }
    }

    #evaluateTemplate(template, context) {
      let hasNull = false;
      const value = template.replace(/\{([^}]+)\}/g, (_, code) => {
        const rawValue = ExpressionParser.evaluate(code.trim(), context);
        if (rawValue === null || rawValue === undefined) hasNull = true;
        return rawValue ?? '';
      });
      return { value, hasNull };
    }

    #setAttributeOrProperty(node, attrName, value, hasNull, attr = null) {
      // Check if this attribute should be set as DOM property
      // Properties like value, checked, disabled exist on DOM elements
      // Exclude style/class - they have object types and need attribute handling
      const shouldUseProperty = attrName in node &&
                                !attrName.startsWith('data-') &&
                                attrName !== 'style' &&
                                attrName !== 'class';

      if (shouldUseProperty) {
        // Boolean properties need special handling
        if (typeof node[attrName] === 'boolean') {
          const boolValue = !hasNull && value !== 'false' &&
                           (value === 'true' || value === '' || value === attrName || value === true);
          if (node[attrName] !== boolValue) {
            node[attrName] = boolValue;
            node.toggleAttribute(attrName, boolValue);
          }
        } else {
          // String/other properties (like value)
          if (node[attrName] !== value) {
            node[attrName] = value;
          }
        }
      } else {
        // Regular attribute
        if (attr) {
          attr.nodeValue = value;
        } else if (node.getAttribute(attrName) !== value) {
          node.setAttribute(attrName, value);
        }
      }
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

    /**
     * Find parent component (excluding framework components)
     */
    _findParentComponent() {
      let parent = this.parentElement;
      for (let depth = 0; parent && depth < 10; depth++, parent = parent.parentElement) {
        const tag = parent.tagName?.toLowerCase();
        const isComponent = tag?.includes('-') || parent.hasAttribute('is');
        const isFramework = tag === 'veda-if' || tag === 'veda-loop';

        if (isComponent && !isFramework) return parent;
      }
      return null;
    }
  }
}

export {reactive, effect};
