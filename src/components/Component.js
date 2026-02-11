import Model from '../Model.js';
import PropertyComponent from './PropertyComponent.js';
import RelationComponent from './RelationComponent.js';
import LoopComponent from './LoopComponent.js';
import ExpressionParser from './ExpressionParser.js';
import {effect} from '../Effect.js';
import {reactive} from '../Reactive.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_TREE_DEPTH = 20;
const EXPR_REGEX = /!\{([^}]+)\}|\{([^}]+)\}/g;
const UNSAFE_MARKER_REGEX = /!\{/g;
const HTML_ESCAPE_MAP = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  "'": '&#39;', '/': '&#x2F;', '\\': '&#x5C;', '`': '&#x60;',
};
const HTML_ESCAPE_REGEX = /[&<>"'/\\`]/g;
const SAFE_EXPR_REGEX = /\{[^}]*\}/g;

// ============================================================================
// TEMPLATE ENGINE (html, raw, safe)
// ============================================================================

const marker = Date.now();
const re = new RegExp(`^${marker}`);

export function raw (strings, ...values) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    let value = values[i] ?? '';
    if (Array.isArray(value)) value = value.join(' ');
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
  return value
    .replace(HTML_ESCAPE_REGEX, char => HTML_ESCAPE_MAP[char])
    .replace(UNSAFE_MARKER_REGEX, '!\u200B{')
    .replace(SAFE_EXPR_REGEX, '');
}

// ============================================================================
// EXPRESSION HELPERS
// ============================================================================

function evalExpr(unsafeCode, safeCode, context) {
  return unsafeCode !== undefined
    ? ExpressionParser.evaluateUnsafe(unsafeCode.trim(), context)
    : ExpressionParser.evaluate(safeCode.trim(), context);
}

function sanitizeExpressionResult(value) {
  if (value == null) return '';
  return String(value).replace(UNSAFE_MARKER_REGEX, '!\u200B{');
}

// ============================================================================
// COMPONENT CLASS
// ============================================================================

export default function Component (ElementClass = HTMLElement, ModelClass = Model) {
  return class ComponentClass extends ElementClass {
    static tag = 'veda-component';
    static toString () { return this.tag; }

    // ---------- Private Fields ----------
    #resolveRendered;
    #childrenRendered = [];
    #effects = [];
    #renderEffects = [];
    #eventListeners = [];
    #isReactive = false;
    template;

    // ---------- Constructor & Lifecycle ----------
    constructor() {
      super();
      const componentRef = new WeakRef(this);
      this.state = reactive({}, {
        onSet: () => {
          if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
            const c = componentRef.deref();
            if (c) window.__VEDA_DEVTOOLS_HOOK__.trackComponentStateChange(c);
          }
        }
      });
      this.#isReactive = true;
      this.rendered = new Promise((resolve) => { this.#resolveRendered = resolve; });
    }

    renderedCallback () {}

    async #setRendered() {
      await Promise.all(this.#childrenRendered);
      this.#resolveRendered?.();
      this.renderedCallback();
    }

    async connectedCallback () {
      try {
        if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
          window.__VEDA_DEVTOOLS_HOOK__.trackComponent(this);
        }
        await this.populate();
        if (!this.isConnected) return;
        const added = this.added();
        if (added instanceof Promise) await added;
        if (!this.isConnected) return;
        await this.update();
      } catch (error) {
        console.log(this, 'Component render error', error);
      } finally {
        this.#setRendered();
      }
    }

    async disconnectedCallback () {
      try {
        if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
          window.__VEDA_DEVTOOLS_HOOK__.untrackComponent(this);
        }
        this.#cleanupEffects();
        this.#cleanupEventListeners();
        if (this.state) {
          for (const key of Object.keys(this.state)) this.state[key] = null;
        }
        const removed = this.removed();
        if (removed instanceof Promise) await removed;
      } catch (error) {
        console.log(this, 'Component remove error', error);
      } finally {
        this.#setRendered();
      }
    }

    #cleanupEffects() {
      this.#effects.forEach(c => c());
      this.#effects = [];
      this.#renderEffects.forEach(c => c());
      this.#renderEffects = [];
    }

    #cleanupEventListeners() {
      this.#eventListeners.forEach(({ node, eventName, handler }) => {
        node.removeEventListener(eventName, handler);
      });
      this.#eventListeners = [];
    }

    // ---------- Lifecycle Hooks (override in subclass) ----------
    added () {}
    pre () {}
    render () { return this.template ?? this.innerHTML; }
    post () {}
    removed () {}

    // ---------- Internal API (used by If/Loop/Virtual) ----------
    _cleanupAllEventListeners() { this.#cleanupEventListeners(); }
    _getRenderEffectsCount() { return this.#renderEffects.length; }
    _extractRenderEffects(startIndex) { return this.#renderEffects.splice(startIndex); }

    // ---------- Render Pipeline ----------
    async update () {
      const _renderStart = performance.now();
      try {
        this.#childrenRendered = [];
        this.#renderEffects.forEach(c => c());
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

        if (typeof window !== 'undefined' && window.__VEDA_DEVTOOLS_HOOK__) {
          window.__VEDA_DEVTOOLS_HOOK__.trackComponentRender(this, _renderStart);
        }

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
      if (this.hasAttribute('about')) {
        const uri = this.getAttribute('about');
        if (!this.state.model || this.state.model.id !== uri) {
          this.state.model = new ModelClass(uri);
        }
      } else if (this.state.model?.id) {
        this.setAttribute('about', this.state.model.id);
      }
      if (this.state.model) {
        try { await this.state.model.load?.(); } catch { /* Backend not configured */ }
        if (this.isConnected && this.state.model) this.state.model.subscribe?.();
      }
    }

    // ========================================================================
    // DOM BINDING - Expression processing in text nodes and attributes
    // ========================================================================

    #processTextNode(textNode) {
      // Skip already processed nodes or nodes inside <style>/<script>
      if (textNode.__vedaProcessed) return;
      const parent = textNode.parentNode;
      if (parent && (parent.tagName === 'STYLE' || parent.tagName === 'SCRIPT')) return;

      const text = textNode.nodeValue;
      EXPR_REGEX.lastIndex = 0;
      if (!EXPR_REGEX.test(text)) return;
      EXPR_REGEX.lastIndex = 0;

      // Parse text into parts: static text and expressions
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = EXPR_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 's', value: text.substring(lastIndex, match.index) });
        }
        // match[1] = unsafe (!{}), match[2] = safe ({})
        parts.push(match[1] !== undefined
          ? { type: 'u', code: match[1].trim() }
          : { type: 'e', code: match[2].trim() });
        lastIndex = EXPR_REGEX.lastIndex;
      }
      if (lastIndex < text.length) {
        parts.push({ type: 's', value: text.substring(lastIndex) });
      }

      if (this.#isReactive) {
        const evalContext = this._currentEvalContext || this;
        const nodes = parts.map(part => {
          if (part.type === 's') return document.createTextNode(part.value);
          const node = document.createTextNode('');
          const isUnsafe = part.type === 'u';
          const cleanup = effect(() => {
            const value = isUnsafe
              ? ExpressionParser.evaluateUnsafe(part.code, evalContext)
              : ExpressionParser.evaluate(part.code, evalContext);
            node.nodeValue = sanitizeExpressionResult(value);
          }, { component: this });
          this.#renderEffects.push(cleanup);
          return node;
        });

        textNode.nodeValue = '';
        let insertAfter = textNode;
        for (const node of nodes) {
          node.__vedaProcessed = true;
          parent.insertBefore(node, insertAfter.nextSibling);
          insertAfter = node;
        }
      } else {
        textNode.nodeValue = text.replace(EXPR_REGEX, (_, u, s) =>
          sanitizeExpressionResult(evalExpr(u, s, this)));
        textNode.__vedaProcessed = true;
      }
    }

    _process (fragment, evalContext = null) {
      const previousContext = this._currentEvalContext;

      if (!evalContext) {
        evalContext = this.state;
        if (evalContext && typeof evalContext === 'object') {
          Object.setPrototypeOf(evalContext, this);
        }
      }
      this._currentEvalContext = evalContext;

      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();

      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          this.#processTextNode(node);
          node = walker.nextNode();
          continue;
        }

        const tag = node.tagName.toLowerCase();
        const hasIs = node.hasAttribute('is');
        const hasDash = tag.includes('-');
        const hasProp = node.hasAttribute('property');
        const hasRel = node.hasAttribute('rel');
        const hasAbout = node.hasAttribute('about');

        // Plain native element - just process attributes
        if (!hasDash && !hasIs && !hasAbout && !hasProp && !hasRel) {
          this.#processAttributes(node);
          node = walker.nextNode();
          continue;
        }

        let component;
        const copyAttrs = (skip) => {
          for (const attr of node.attributes) {
            if (attr.nodeName !== skip) component.setAttribute(attr.nodeName, attr.nodeValue);
          }
        };

        if (hasDash) {
          // Custom element (e.g., <my-component>)
          if (!customElements.get(tag)) throw Error(`Custom elements registry has no entry for tag '${tag}'`);
          component = document.createElement(tag);
          copyAttrs();
        } else if (hasIs) {
          // Customized built-in (e.g., <div is="my-div">)
          const is = node.getAttribute('is');
          if (!customElements.get(is)) throw Error(`Custom elements registry has no entry for '${is}'`);
          component = document.createElement(tag, {is});
          component.setAttribute('is', is);
          copyAttrs('is');
        } else if (hasProp || hasRel) {
          // Property/Relation component
          const type = hasProp ? 'property' : 'rel';
          const is = `${tag}-${type}-component`;
          if (!customElements.get(is)) {
            customElements.define(is, (type === 'property' ? PropertyComponent : RelationComponent)(node.constructor), {extends: tag});
          }
          component = document.createElement(tag, {is});
          component.setAttribute('is', is);
          copyAttrs();
          if (!component.hasAttribute('about')) {
            const model = this._currentEvalContext?.model || this.state.model;
            if (model) component.state.model = model;
          }
        } else if (hasAbout) {
          // Inline component with about attribute
          const is = `${tag}-inline-component`;
          if (!customElements.get(is)) {
            customElements.define(is, Component(node.constructor), {extends: tag});
          }
          component = document.createElement(tag, {is});
          component.setAttribute('is', is);
          copyAttrs();
        }

        // Propagate current eval context so child components (e.g. veda-if inside veda-loop)
        // can access loop variables through the prototype chain
        component._vedaEvalContext = this._currentEvalContext;
        component.template = node.innerHTML.trim();
        this.#processAttributes(component);
        node.parentNode.replaceChild(component, node);
        this.#childrenRendered.push(component.rendered);

        // Find next node
        walker.currentNode = component;
        let next = component.nextSibling;
        if (!next) {
          let p = component.parentNode;
          while (p && p.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
            if (p.nextSibling) { next = p.nextSibling; break; }
            p = p.parentNode;
          }
        }
        if (next) walker.currentNode = next;
        node = next;
      }

      this._currentEvalContext = previousContext;
    }

    #findMethod (name) {
      if (typeof this[name] === 'function') {
        return { method: this[name], context: this };
      }
      // Search up the component tree
      let el = this.parentElement || this.getRootNode?.()?.host;
      for (let i = 0; el && i < MAX_TREE_DEPTH; i++) {
        if ((el.tagName?.includes('-') || el.hasAttribute?.('is')) && typeof el[name] === 'function') {
          return { method: el[name], context: el };
        }
        el = el.parentElement || el.getRootNode?.()?.host;
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
      const tag = node.tagName.toLowerCase();
      const isFramework = tag === 'veda-if' || tag === 'veda-loop' || tag === 'veda-virtual';
      const skip = isFramework ? ['condition', 'items', 'as', 'key', 'item-key', 'height', 'item-height', 'overscan'] : [];

      for (const attr of [...node.attributes]) {
        if (attr.nodeName.startsWith(':')) {
          this.#processPropertyBinding(node, attr);
        } else if (!skip.includes(attr.name) && attr.value?.includes('{')) {
          this.#processAttrExpr(node, attr, false);
        }
      }
    }

    #processPropertyBinding(node, attr) {
      const propName = attr.nodeName.slice(1).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      const expr = attr.nodeValue;
      node.removeAttribute(attr.nodeName);

      const evalContext = this._currentEvalContext || this;
      const target = node.state || node;

      // Check for pure expression (single {expr} or !{expr})
      const pureUnsafe = expr.match(/^!\{(.+)\}$/);
      const pureSafe = !pureUnsafe && expr.match(/^\{([^}]+)\}$/);

      if (this.#isReactive && expr.includes('{')) {
        const cleanup = effect(() => {
          if (pureUnsafe) {
            target[propName] = ExpressionParser.evaluateUnsafe(pureUnsafe[1].trim(), evalContext);
          } else if (pureSafe) {
            target[propName] = ExpressionParser.evaluate(pureSafe[1].trim(), evalContext);
          } else {
            target[propName] = expr.replace(EXPR_REGEX, (_, u, s) => evalExpr(u, s, evalContext));
          }
        }, { component: this });
        this.#renderEffects.push(cleanup);
      } else {
        if (pureUnsafe) {
          target[propName] = ExpressionParser.evaluateUnsafe(pureUnsafe[1].trim(), this);
        } else if (pureSafe) {
          target[propName] = ExpressionParser.evaluate(pureSafe[1].trim(), this);
        } else {
          target[propName] = expr.replace(EXPR_REGEX, (_, u, s) => evalExpr(u, s, this));
        }
      }
    }

    #processNativeElementAttributes(node) {
      for (const attr of [...node.attributes]) {
        const name = attr.name;
        const hasExpr = attr.value?.includes('{');
        if (name.startsWith(':')) {
          this.#processPropertyBinding(node, attr);
        } else if (name.startsWith('on') && name.length > 2 && hasExpr) {
          this.#processEventAttribute(node, attr);
        } else if (hasExpr) {
          this.#processAttrExpr(node, attr, true);
        }
      }
    }

    #processEventAttribute(node, attr) {
      const eventName = attr.name.slice(2).toLowerCase();
      const expr = attr.value.replace(/[{}]/g, '').trim();
      node.removeAttribute(attr.name);

      let handler;
      try {
        const result = ExpressionParser.evaluate(expr, this, true);
        if (result && typeof result.value === 'function') {
          handler = (e) => result.value.call(result.context, e, node);
        } else if (/^\w+$/.test(expr)) {
          handler = (e) => {
            const found = this.#findMethod(expr);
            if (found) found.method.call(found.context, e, node);
          };
        }
      } catch (error) {
        console.warn(`Invalid event handler '${expr}':`, error.message);
        return;
      }

      if (handler) {
        node.addEventListener(eventName, handler);
        this.#eventListeners.push({ node, eventName, handler });
      } else {
        console.warn(`Handler '${expr}' did not resolve to a function`);
      }
    }

    // Unified attribute expression handler
    // isNative=true: use smart property handling (value, checked, etc.)
    // isNative=false: simple setAttribute for custom components
    #processAttrExpr(node, attr, isNative) {
      const attrName = attr.nodeName;
      const template = attr.nodeValue;
      const ctx = this._currentEvalContext || this;
      const isReactive = ctx.__isReactive || ctx.state?.__isReactive || false;

      EXPR_REGEX.lastIndex = 0;
      if (!EXPR_REGEX.test(template)) return;

      if (isReactive) {
        if (isNative) node.removeAttribute(attrName);
        const cleanup = effect(() => {
          if (isNative) {
            const { value, hasNull } = this.#evaluateTemplate(template, ctx);
            this.#setAttributeOrProperty(node, attrName, value, hasNull);
          } else {
            const value = template.replace(EXPR_REGEX, (_, u, s) =>
              sanitizeExpressionResult(evalExpr(u, s, ctx)));
            if (node.getAttribute(attrName) !== value) node.setAttribute(attrName, value);
          }
        }, { component: this });
        this.#renderEffects.push(cleanup);
      } else if (isNative) {
        const { value, hasNull } = this.#evaluateTemplate(template, this);
        this.#setAttributeOrProperty(node, attrName, value, hasNull, attr);
      } else {
        attr.nodeValue = template.replace(EXPR_REGEX, (_, u, s) =>
          sanitizeExpressionResult(evalExpr(u, s, this)));
      }
    }

    #evaluateTemplate(template, context) {
      let hasNull = false;
      const value = template.replace(EXPR_REGEX, (_, u, s) => {
        const raw = evalExpr(u, s, context);
        if (raw == null) hasNull = true;
        return sanitizeExpressionResult(raw);
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

    // ========================================================================
    // PUBLIC API - Reactivity helpers
    // ========================================================================

    effect(fn) {
      const cleanup = effect(fn, { component: this });
      this.#effects.push(cleanup);
      return cleanup;
    }

    /**
     * Watch a value and run callback when it changes (reference equality).
     * For arrays: watch length or reassign after mutation.
     */
    watch(getter, callback, options = {}) {
      let oldValue, isFirst = true;
      const cleanup = effect(() => {
        const newValue = getter();
        if (isFirst) {
          isFirst = false;
          oldValue = newValue;
          if (options.immediate) callback(newValue, undefined);
        } else if (newValue !== oldValue) {
          callback(newValue, oldValue);
          oldValue = newValue;
        }
      }, { ...options, component: this });
      this.#effects.push(cleanup);
      return cleanup;
    }

    _findParentComponent() {
      let parent = this.parentElement;
      for (let d = 0; parent && d < MAX_TREE_DEPTH; d++, parent = parent.parentElement) {
        const tag = parent.tagName?.toLowerCase();
        if ((tag?.includes('-') || parent.hasAttribute('is')) && tag !== 'veda-if' && tag !== 'veda-loop') {
          return parent;
        }
      }
      return null;
    }
  }
}

export {reactive, effect};
