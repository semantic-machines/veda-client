import {effect} from '../Effect.js';
import {toRaw} from '../Reactive.js';
import ExpressionParser from '../components/ExpressionParser.js';
import {isTemplateResult, isUnsafeHTML, isUnsafeStatic, nothing, noChange} from './TemplateResult.js';
import {compileTemplate, trustedHTML} from './Template.js';
import {ELEMENT_MARKER, TEXT_MARKER_RE} from './markers.js';
import {
  EVENT_NAME_RE, assertSafeDataAttributeName, assertSafeDataPropertyName,
  assertSafeUrlValue, describeValue,
} from './security.js';
import {factories} from './factories.js';

const METHOD_NAME_RE = /^(?:this\.)?([A-Za-z_$][\w$]*)$/;
const MAX_TREE_DEPTH = 20;

const BOOLEAN_ATTRIBUTES = new Set([
  'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls',
  'default', 'defer', 'disabled', 'hidden', 'inert', 'loop', 'multiple',
  'muted', 'open', 'playsinline', 'readonly', 'required', 'reversed', 'selected',
]);

function findMethod(start, name) {
  let obj = start;
  let instanceOwner = null;

  for (let depth = 0; obj && depth < MAX_TREE_DEPTH; depth++) {
    const raw = toRaw(obj) || obj;

    if (raw instanceof Element && raw.state) instanceOwner = raw;

    if (typeof raw[name] === 'function') {
      if (Object.prototype.hasOwnProperty.call(raw, name)) {
        return {fn: raw[name], owner: instanceOwner || raw};
      }
      // Inherited function: keep walking so the owner is the actual component
      // instance, not the prototype object that stores the method.
    }

    const next = Object.getPrototypeOf(raw);
    if (!next || next === Object.prototype) break;
    obj = next;
  }
  return null;
}

function findComponentOwner(start) {
  let obj = start;
  for (let depth = 0; obj && depth < MAX_TREE_DEPTH; depth++) {
    const raw = toRaw(obj) || obj;
    if (raw instanceof Element && raw.state) return raw;
    const next = Object.getPrototypeOf(raw);
    if (!next || next === Object.prototype) break;
    obj = next;
  }
  return null;
}

function resolveOwnedFromExpr(expr, evalContext) {
  const methodMatch = expr.match(METHOD_NAME_RE);
  if (methodMatch) return findMethod(evalContext, methodMatch[1]);

  const result = ExpressionParser.evaluate(expr, evalContext, true);
  if (!result || typeof result.value !== 'function') return null;

  const key = expr.split(/[?.]/).filter(Boolean).pop();
  const ctx = result.context;
  const rawOwner = toRaw(ctx) || ctx;

  if (rawOwner instanceof Element) {
    return {fn: rawOwner[key] || result.value, owner: rawOwner};
  }

  const component = findComponentOwner(ctx);
  if (component) {
    return {fn: component[key] || result.value, owner: component};
  }

  // Plain reactive item/context object: keep the proxy as the receiver so
  // mutations inside the handler still go through reactivity.
  return {fn: ctx?.[key] || result.value, owner: ctx};
}

function bindOwned(owned) {
  if (!owned || typeof owned.fn !== 'function') return owned?.fn;
  return owned.fn.bind(owned.owner);
}

function assignExprPath(context, expr, value) {
  let path = expr.trim();
  if (path === 'this') return;
  if (path.startsWith('this.')) path = path.slice(5);
  path = path.replace(/\?\./g, '.');
  const parts = path.split('.').filter(Boolean);
  let obj = context;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj?.[parts[i]];
    if (obj == null) return;
  }
  const last = parts[parts.length - 1];
  if (obj && last) obj[last] = value;
}

function segmentValueText(value, type = 'text') {
  if (value == null || value === nothing) return '';
  // A static-trusted value used in a value position is still just a string.
  if (isUnsafeStatic(value)) return String(value.value ?? '');
  if (isTemplateResult(value)) {
    // A template is DOM, not an attribute/property value.
    return '';
  }
  if (isUnsafeHTML(value)) return type === 'attribute' ? String(value.value) : '';
  if (typeof Node !== 'undefined' && value instanceof Node) return '';
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item == null || item === nothing || item === noChange) return '';
        if (isTemplateResult(item) || isUnsafeHTML(item) ||
          (typeof Node !== 'undefined' && item instanceof Node)) return '';
        return String(item);
      })
      .join(' ');
  }
  return String(value);
}

function evalSegments(segments, context, values, type) {
  let text = '';
  let hasNull = false;
  let hasNothing = false;

  for (const segment of segments) {
    if (segment.type === 'static') {
      text += segment.value;
      continue;
    }

    let value;
    if (segment.type === 'expr') {
      value = ExpressionParser.evaluateAuto(segment.code, context);
      if (value === noChange) return {noChange: true};
      if (value == null) hasNull = true;
      if (value === nothing) hasNothing = true;
      text += value == null || value === nothing ? '' : String(value);
      continue;
    }

    value = segment.type === 'constant'
      ? segment.value
      : values?.[segment.index];

    if (value === noChange) return {noChange: true};
    if (value == null) hasNull = true;
    if (value === nothing) hasNothing = true;
    text += segmentValueText(value, type);
  }

  return {text, hasNull, hasNothing};
}

function isStructured(value) {
  if (isTemplateResult(value) || isUnsafeHTML(value)) return true;
  if (typeof Node !== 'undefined' && value instanceof Node) return true;
  if (Array.isArray(value)) return value.some(item => isStructured(item));
  return false;
}

// ---------------------------------------------------------------------------
// ChildPart
// ---------------------------------------------------------------------------

class ChildPart {
  #anchor;
  #anchorMode;
  #segment;
  #values;
  #context;
  #host;
  #instance;
  #stop = null;
  #textNode = null;
  #nodes = [];
  #nested = null;

  constructor(anchor, descriptor, context, host, instance, values) {
    this.#anchor = anchor;
    this.#anchorMode = descriptor.anchor || 'node';
    this.#segment = descriptor.segment;
    this.#context = context;
    this.#host = host;
    this.#instance = instance;
    this.#values = values || [];

    if (descriptor.segment.type === 'expr') {
      this.#stop = effect(() => this.commit(), {component: host, internal: true});
    } else {
      this.commit();
    }
  }

  setValues(values) {
    this.#values = values || [];
    this.commit();
  }

  #evaluate() {
    const segment = this.#segment;
    if (segment.type === 'expr') {
      return ExpressionParser.evaluateAuto(segment.code, this.#context);
    }
    if (segment.type === 'constant') return segment.value;
    return this.#values?.[segment.index];
  }

  commit() {
    const value = this.#evaluate();
    if (value === noChange) return;

    if (this.#anchorMode === 'text') {
      this.#anchor.nodeValue = value == null || value === nothing
        ? ''
        : segmentValueText(value, 'text') || String(value);
      return;
    }

    if (value == null || value === nothing) {
      this.#clear();
      return;
    }

    if (isTemplateResult(value)) {
      this.#renderTemplate(value);
      return;
    }

    if (isUnsafeHTML(value)) {
      this.#renderUnsafeHTML(value);
      return;
    }

    if (isStructured(value)) {
      this.#renderStructured(value);
      return;
    }

    const text = this.#segment.type === 'expr'
      ? String(value)
      : segmentValueText(value, 'text');
    this.#setText(text);
  }

  #setText(text) {
    if (this.#nodes.length || this.#nested) this.#clearStructured();
    if (!this.#textNode || this.#textNode.parentNode !== this.#anchor.parentNode) {
      this.#textNode = document.createTextNode(text);
      this.#anchor.parentNode?.insertBefore(this.#textNode, this.#anchor);
    } else {
      this.#textNode.nodeValue = text;
    }
  }

  #renderTemplate(value) {
    const compiled = compileTemplate(value);
    if (this.#nested && this.#nested.compiled === compiled) {
      this.#nested.setResult(value);
      this.#nodes = this.#nested.rootNodes;
      return;
    }

    this.#clear();
    const nested = compiled.instantiate(this.#context, this.#host, {
      values: value.values,
    });
    const nodes = nested.rootNodes;
    this.#insertBefore(nodes);
    this.#nested = nested;
    this.#nodes = nodes;
    this.#adoptChildren(nested.childrenRendered);
  }

  #renderUnsafeHTML(value) {
    this.#clear();
    const template = document.createElement('template');
    template.innerHTML = trustedHTML(String(value.value ?? ''));
    const nodes = Array.from(template.content.childNodes);
    this.#insertBefore(nodes);
    this.#nodes = nodes;
  }

  #renderStructured(value) {
    this.#clear();
    const nodes = [];
    const nested = [];
    let text = '';

    const flushText = () => {
      if (!text) return;
      nodes.push(document.createTextNode(text));
      text = '';
    };

    const append = (item) => {
      if (item == null || item === nothing || item === noChange) return;
      if (isTemplateResult(item)) {
        flushText();
        const compiled = compileTemplate(item);
        const child = compiled.instantiate(this.#context, this.#host, {
          values: item.values,
        });
        nodes.push(...child.rootNodes);
        nested.push(child);
        this.#adoptChildren(child.childrenRendered);
        return;
      }
      if (isUnsafeHTML(item)) {
        flushText();
        const template = document.createElement('template');
        template.innerHTML = trustedHTML(String(item.value ?? ''));
        nodes.push(...Array.from(template.content.childNodes));
        return;
      }
      if (typeof Node !== 'undefined' && item instanceof Node) {
        flushText();
        const source = item.nodeType === Node.DOCUMENT_FRAGMENT_NODE
          ? Array.from(item.childNodes)
          : [item];
        nodes.push(...source);
        return;
      }
      if (Array.isArray(item)) {
        item.forEach((entry, index) => {
          if (index > 0 && !isStructured(entry)) text += ' ';
          append(entry);
        });
        return;
      }
      text += String(item);
    };

    append(value);
    flushText();

    this.#insertBefore(nodes);
    this.#nodes = nodes;
    this.#nested = nested;
  }

  #insertBefore(nodes) {
    const parent = this.#anchor.parentNode;
    if (!parent) return;
    for (const node of nodes) parent.insertBefore(node, this.#anchor);
  }

  #clearStructured() {
    if (this.#textNode) {
      this.#textNode.remove();
      this.#textNode = null;
    }
    for (const node of this.#nodes) node.remove?.();
    this.#nodes = [];
    for (const nested of this.#nestedList()) {
      // A nested instance may have inserted top-level nodes after it was
      // created; remove those before the static roots captured at mount time
      // are dropped, otherwise they become orphaned DOM.
      nested.clearRendered?.();
      nested.destroy();
    }
    this.#nested = null;
  }

  clearRendered() {
    this.#clearStructured();
  }

  #clear() {
    this.#clearStructured();
    this.#anchor.nodeValue = '';
  }

  #adoptChildren(children) {
    if (!children?.length) return;
    for (const child of children) {
      if (!this.#instance.childrenRendered.includes(child)) {
        this.#instance.childrenRendered.push(child);
      }
    }
  }

  #nestedList() {
    if (!this.#nested) return [];
    return Array.isArray(this.#nested) ? this.#nested : [this.#nested];
  }

  refresh() {
    for (const nested of this.#nestedList()) nested.refreshRefs?.();
  }

  listenerCount() {
    let count = 0;
    for (const nested of this.#nestedList()) {
      count += nested.getEventListenersCount?.() || 0;
    }
    return count;
  }

  destroy() {
    this.#stop?.();
    this.#stop = null;
    // Keep the rendered DOM in the detached subtree, matching the legacy
    // lifecycle. Refs/listeners/effects are released, but textContent is not
    // mutated just because a component was disconnected.
    for (const nested of this.#nestedList()) nested.destroy();
    this.#nested = null;
    this.#nodes = [];
    this.#textNode = null;
  }
}

// ---------------------------------------------------------------------------
// AttributePart / PropertyPart
// ---------------------------------------------------------------------------

class AttributePart {
  #stop = null;

  constructor(element, descriptor, context, host, values) {
    this.element = element;
    this.name = descriptor.name;
    this.mode = descriptor.mode || 'native';
    this.segments = descriptor.segments;
    this.context = context;
    this.host = host;
    this.values = values || [];
    this.boolean = BOOLEAN_ATTRIBUTES.has(this.name);

    if (descriptor.expression) {
      this.#stop = effect(() => this.commit(), {component: host, internal: true});
    } else {
      this.commit();
    }
  }

  setValues(values) {
    this.values = values || [];
    this.commit();
  }

  commit() {
    const {text, hasNull, hasNothing, noChange: skip} = evalSegments(
      this.segments, this.context, this.values, 'attribute'
    );
    if (skip) return;

    if (this.mode === 'component') {
      if (hasNothing && text === '') this.element.removeAttribute(this.name);
      else if (this.element.getAttribute(this.name) !== text) {
        this.element.setAttribute(this.name, text);
      }
      return;
    }

    if (hasNothing && text === '') {
      this.element.removeAttribute(this.name);
      if (this.boolean && this.name in this.element) {
        this.element[this.name] = false;
      } else if (this.name in this.element) {
        this.element[this.name] = '';
      }
      return;
    }

    this.#setAttributeOrProperty(text, hasNull);
  }

  #setAttributeOrProperty(value, hasNull) {
    const node = this.element;
    const attrName = this.name;
    const shouldUseProperty = !this.boolean &&
      attrName in node &&
      !attrName.startsWith('data-') &&
      attrName !== 'style' &&
      attrName !== 'class';

    if (this.boolean) {
      const boolValue = !hasNull && value !== 'false' &&
        (value === 'true' || value === '' || value === attrName);
      if (node[attrName] !== boolValue) {
        node[attrName] = boolValue;
        node.toggleAttribute(attrName, boolValue);
      }
      return;
    }

    assertSafeUrlValue(attrName.toLowerCase(), value);

    if (shouldUseProperty) {
      if (node[attrName] !== value) {
        node[attrName] = value;
      }
      return;
    }

    if (node.getAttribute(attrName) !== value) {
      node.setAttribute(attrName, value);
    }
  }

  destroy() {
    this.#stop?.();
    this.#stop = null;
  }
}

class PropertyPart {
  #stop = null;

  constructor(element, descriptor, context, host, values) {
    this.element = element;
    this.target = element.state || element;
    this.name = descriptor.name;
    this.segments = descriptor.segments;
    this.context = context;
    this.host = host;
    this.values = values || [];

    if (descriptor.expression) {
      this.#stop = effect(() => this.commit(), {component: host, internal: true});
    } else {
      this.commit();
    }
  }

  setValues(values) {
    this.values = values || [];
    this.commit();
  }

  commit() {
    const pure = this.segments.length === 1 && this.segments[0].type === 'expr';
    const rawTarget = toRaw(this.target) || this.target;

    if (pure) {
      const code = this.segments[0].code;
      const value = this.#evaluatePropertyValue(code);
      if (value === noChange) return;
      if (typeof value === 'string') assertSafeUrlValue(this.name.toLowerCase(), value);
      if (rawTarget[this.name] !== value) {
        this.target[this.name] = value === nothing ? '' : value;
      }
      return;
    }

    const {text, noChange: skip} = evalSegments(
      this.segments, this.context, this.values, 'property'
    );
    if (skip) return;
    assertSafeUrlValue(this.name.toLowerCase(), text);
    if (rawTarget[this.name] !== text) {
      this.target[this.name] = text;
    }
  }

  #evaluatePropertyValue(code) {
    try {
      const owned = resolveOwnedFromExpr(code, this.context);
      if (owned) return bindOwned(owned);
    } catch {
      // Not a function path — fall through to the normal evaluator.
    }
    return ExpressionParser.evaluateAuto(code, this.context);
  }

  destroy() {
    this.#stop?.();
    this.#stop = null;
  }
}

// ---------------------------------------------------------------------------
// AttributesPart (`${attrs}`)
// ---------------------------------------------------------------------------

const SPREAD_ATTRIBUTE = 'attribute';
const SPREAD_BOOLEAN = 'boolean';
const SPREAD_PROPERTY = 'property';
const SPREAD_EVENT = 'event';

function spreadValueText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(' ');
  if (isUnsafeStatic(value)) return String(value.value ?? '');
  if (isUnsafeHTML(value)) return String(value.value ?? '');
  if (typeof value === 'object') {
    throw new TypeError(
      `A ${'${attrs}'} attribute value must be a primitive, got ${describeValue(value)}`,
    );
  }
  return String(value);
}

function spreadEntries(value) {
  if (value == null) return [];
  if (value instanceof Map) return Array.from(value.entries());
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => spreadEntries(entry));
    }
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      return Object.entries(value);
    }
  }
  // Strings used to be parsed as markup here. That is exactly the hole the
  // engine closed: a spread value is data, and data never becomes markup.
  throw new TypeError(
    `\${attrs} expects an object of attributes (or a Map), got ${describeValue(value)}. ` +
    'Markup is not parsed from values; use unsafeHTML() for trusted markup.',
  );
}

/**
 * Applies an attribute object (`${attrs}`) through the DOM API.
 *
 * The part owns the names it wrote: keys that disappear are removed on the
 * next update. Names that only the framework may author (`items`, `ref`,
 * `about`, ...), event handler content attributes, `srcdoc` and `javascript:`
 * URLs are rejected, so a data-driven spread cannot create a capability or a
 * code-execution sink.
 */
class AttributesPart {
  #applied = new Map();
  #values;

  constructor(element, descriptor, context, host, values) {
    this.element = element;
    this.context = context;
    this.host = host;
    this.valueIndex = descriptor.valueIndex;
    this.#values = values || [];
    this.setValues(this.#values);
  }

  setValues(values) {
    this.#values = values || [];
    this.commit();
  }

  commit() {
    const next = new Map();
    for (const [rawName, value] of spreadEntries(this.#values?.[this.valueIndex])) {
      next.set(rawName, value);
    }

    for (const rawName of Array.from(this.#applied.keys())) {
      if (!next.has(rawName)) this.#remove(rawName);
    }

    for (const [rawName, value] of next) this.#set(rawName, value);
  }

  #parseName(rawName) {
    if (typeof rawName !== 'string' || rawName === '') {
      throw new TypeError(`Invalid attribute slot ${JSON.stringify(rawName)} in a \${attrs} value`);
    }
    if (rawName.startsWith('?')) return {kind: SPREAD_BOOLEAN, name: rawName.slice(1)};
    if (rawName.startsWith('.')) return {kind: SPREAD_PROPERTY, name: rawName.slice(1)};
    if (rawName.startsWith('@')) return {kind: SPREAD_EVENT, name: rawName.slice(1)};
    return {kind: SPREAD_ATTRIBUTE, name: rawName};
  }

  #set(rawName, value) {
    const {kind, name} = this.#parseName(rawName);
    const previous = this.#applied.get(rawName);
    if (previous && previous.kind !== kind) this.#remove(rawName);

    if (kind === SPREAD_EVENT) {
      if (!EVENT_NAME_RE.test(name)) {
        throw new Error(`Invalid event name "@${name}" in a \${attrs} value`);
      }
      if (typeof value !== 'function') {
        throw new Error(`The "@${name}" spread listener must be a function, got ${describeValue(value)}`);
      }
      if (previous?.value !== value) {
        if (previous?.value) this.element.removeEventListener(name, previous.value);
        this.element.addEventListener(name, value);
      }
      this.#applied.set(rawName, {kind, name, value});
      return;
    }

    if (kind === SPREAD_PROPERTY) {
      // Properties are set on the element itself, never on component state:
      // data may decorate a node, but it may not reach into a component.
      assertSafeDataPropertyName(name);
      assertSafeUrlValue(name.toLowerCase(), value);
      if (this.element[name] !== value) {
        this.element[name] = value;
      }
      this.#applied.set(rawName, {kind, name, value});
      return;
    }

    assertSafeDataAttributeName(name);

    if (kind === SPREAD_BOOLEAN) {
      const on = value !== false && value != null && value !== 'false';
      if (this.element.hasAttribute(name) !== on) {
        this.element.toggleAttribute(name, on);
      }
      this.#applied.set(rawName, {kind, name, value});
      return;
    }

    if (value == null || value === false) {
      this.#remove(rawName);
      return;
    }

    assertSafeUrlValue(name.toLowerCase(), value);
    const text = value === true ? '' : spreadValueText(value);
    if (this.element.getAttribute(name) !== text) {
      this.element.setAttribute(name, text);
    }
    this.#applied.set(rawName, {kind, name, value});
  }

  #remove(rawName) {
    const entry = this.#applied.get(rawName);
    if (!entry) return;
    this.#applied.delete(rawName);
    if (entry.kind === SPREAD_EVENT) {
      if (entry.value) this.element.removeEventListener(entry.name, entry.value);
      return;
    }
    if (entry.kind === SPREAD_PROPERTY) return;
    if (entry.kind === SPREAD_BOOLEAN) {
      this.element.toggleAttribute(entry.name, false);
      return;
    }
    this.element.removeAttribute(entry.name);
  }

  listenerCount() {
    let count = 0;
    for (const entry of this.#applied.values()) {
      if (entry.kind === SPREAD_EVENT) count += 1;
    }
    return count;
  }

  destroy() {
    for (const rawName of Array.from(this.#applied.keys())) {
      if (this.#applied.get(rawName)?.kind === SPREAD_EVENT) this.#remove(rawName);
    }
    this.#applied.clear();
  }
}

// ---------------------------------------------------------------------------
// EventPart
// ---------------------------------------------------------------------------

class EventPart {
  constructor(element, descriptor, context) {
    this.element = element;
    this.eventName = descriptor.eventName;
    this.expr = descriptor.expr;
    this.context = context;
    this.methodName = descriptor.expr.match(METHOD_NAME_RE)?.[1] || null;

    // Resolve on every dispatch. This keeps dynamic handlers current without
    // requiring a remount, and matches Lit's "one listener, current value"
    // model.
    this.handler = (event) => {
      let owned = null;
      try {
        owned = this.methodName
          ? findMethod(this.context, this.methodName)
          : resolveOwnedFromExpr(this.expr, this.context);
      } catch (error) {
        console.warn(`Invalid event handler '${this.expr}':`, error.message);
      }
      if (!owned) {
        console.warn(`Handler '${this.expr}' did not resolve to a function`);
        return;
      }
      owned.fn.call(owned.owner, event, this.element);
    };

    this.element.addEventListener(this.eventName, this.handler);

    // Warn at render time for an expression that cannot resolve yet, but keep
    // resolving on dispatch so a later valid handler starts working.
    if (!this.methodName) {
      try {
        if (!resolveOwnedFromExpr(this.expr, this.context)) {
          console.warn(`Handler '${this.expr}' did not resolve to a function`);
        }
      } catch (error) {
        console.warn(`Invalid event handler '${this.expr}':`, error.message);
      }
    }
  }

  setValues() {}

  destroy() {
    if (this.handler) {
      this.element.removeEventListener(this.eventName, this.handler);
      this.handler = null;
    }
  }

  listenerCount() {
    return this.handler ? 1 : 0;
  }
}

// ---------------------------------------------------------------------------
// RefPart / BindPart
// ---------------------------------------------------------------------------

class RefPart {
  #targets = new Set();

  constructor(element, name, host) {
    this.element = element;
    this.name = name;
    this.host = host;
    this.register();
  }

  get target() {
    return this.host._vedaRefsTarget || this.host;
  }

  register() {
    if (!this.name) return;
    const target = this.target;
    this.#targets.add(target);
    if (!target.refs) target.refs = {};
    target.refs[this.name] = this.element;
  }

  refresh() {
    this.register();
  }

  destroy() {
    for (const target of this.#targets) {
      if (target?.refs?.[this.name] === this.element) {
        delete target.refs[this.name];
      }
    }
    this.#targets.clear();
  }
}

class BindPart {
  #stop = null;

  constructor(element, descriptor, context, host) {
    this.element = element;
    this.expr = descriptor.expr;
    this.context = context;
    this.host = host;

    if (!ExpressionParser.isSafe(this.expr)) {
      console.warn(`bind expects a simple path, got '{${this.expr}}'`);
      return;
    }

    const isCheckbox = element.type === 'checkbox';
    const isRadio = element.type === 'radio';

    this.applyValue = (value) => {
      if (isRadio) {
        element.checked = String(value ?? '') === String(element.value);
      } else if (isCheckbox) {
        element.checked = !!value;
      } else if (element.value !== String(value ?? '')) {
        element.value = value ?? '';
      }
    };

    this.#stop = effect(() => {
      this.applyValue(ExpressionParser.evaluate(this.expr, context));
    }, {component: host, internal: true});

    this.handler = (event) => {
      if (isRadio) {
        if (event.target.checked) assignExprPath(context, this.expr, event.target.value);
        return;
      }
      const value = isCheckbox ? event.target.checked : event.target.value;
      assignExprPath(context, this.expr, value);
    };

    this.eventName = isCheckbox || isRadio || element.tagName === 'SELECT' ? 'change' : 'input';
    element.addEventListener(this.eventName, this.handler);
  }

  setValues() {}

  destroy() {
    this.#stop?.();
    this.#stop = null;
    if (this.handler) this.element.removeEventListener(this.eventName, this.handler);
  }

  listenerCount() {
    return this.handler ? 1 : 0;
  }
}

// ---------------------------------------------------------------------------
// Component creation
// ---------------------------------------------------------------------------

function defineBuiltin(tag, is, factory, elementClass) {
  if (customElements.get(is)) return;
  if (!factory) throw new Error(`No component factory registered for '${is}'`);
  customElements.define(is, factory(elementClass), {extends: tag});
}

function createComponentElement(descriptor, context, host, instance) {
  const {kind, tag, elementClass} = descriptor;
  let isName = null;
  let factory = null;

  switch (kind) {
    case 'custom':
      if (!customElements.get(tag)) {
        throw new Error(`Custom elements registry has no entry for tag '${tag}'`);
      }
      break;
    case 'is':
      isName = descriptor.is;
      if (!isName || !customElements.get(isName)) {
        throw new Error(`Custom elements registry has no entry for '${isName}'`);
      }
      break;
    case 'about':
      isName = `${tag}-inline-component`;
      factory = factories.Component;
      break;
    case 'property':
      isName = `${tag}-property-component`;
      factory = factories.Property;
      break;
    case 'rel':
      isName = `${tag}-rel-component`;
      factory = factories.Relation;
      break;
    case 'items':
      isName = `${tag}-loop-component`;
      factory = factories.Loop;
      break;
    case 'condition':
      isName = `${tag}-if-component`;
      factory = factories.If;
      break;
    default:
      throw new Error(`Unknown component kind '${kind}'`);
  }

  let component;
  if (kind === 'custom') {
    component = document.createElement(tag);
  } else {
    if (factory) defineBuiltin(tag, isName, factory, elementClass);
    component = document.createElement(tag, {is: isName});
    component.setAttribute('is', isName);
  }

  for (const [name, value] of descriptor.staticAttrs || []) {
    if (name === 'is' && kind !== 'custom') continue;
    component.setAttribute(name, value);
  }

  // Kept separately from the legacy string: the raw source still carries
  // `${}` tokens, so Slot projection can compile it with the parent values and
  // keep them as values (with the usual URL/attribute policy).
  component._templateSource = descriptor.childSource || '';
  component._compiledTemplate = descriptor.childCompiled || null;
  component._vedaEvalContext = context;
  component._templateValues = instance.values;

  if ((kind === 'property' || kind === 'rel') && !component.hasAttribute('about')) {
    const model = context?.model || host?.state?.model;
    if (model) component.state.model = model;
  }

  instance.components.push({component, descriptor});
  if (component.rendered) instance.childrenRendered.push(component.rendered);
  return component;
}

// ---------------------------------------------------------------------------
// Marker resolution
// ---------------------------------------------------------------------------

function collectMarkers(fragment) {
  const elements = new Map();
  const duplicates = new Set();
  for (const element of fragment.querySelectorAll(`[${ELEMENT_MARKER}]`)) {
    const id = Number(element.getAttribute(ELEMENT_MARKER));
    element.removeAttribute(ELEMENT_MARKER);
    if (!id) continue;
    // Two markers with the same id mean the compiled template is corrupt. The
    // marker name is randomized, so this can only be a compiler bug - fail
    // loudly instead of binding Parts to the wrong element.
    if (elements.has(id)) duplicates.add(id);
    elements.set(id, element);
  }

  const children = new Map();
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const match = TEXT_MARKER_RE.exec(node.nodeValue);
    if (match) {
      node.nodeValue = '';
      const id = Number(match[1]);
      if (children.has(id)) duplicates.add(id);
      children.set(id, node);
    }
    node = walker.nextNode();
  }

  if (duplicates.size) {
    throw new Error(
      `Template marker collision for part(s) ${[...duplicates].join(', ')}; ` +
      'the compiled template is corrupt',
    );
  }
  return {elements, children};
}

function createElementPart(element, descriptor, context, host, values) {
  switch (descriptor.type) {
    case 'attribute':
      return new AttributePart(element, descriptor, context, host, values);
    case 'spread':
      return new AttributesPart(element, descriptor, context, host, values);
    case 'property':
      return new PropertyPart(element, descriptor, context, host, values);
    case 'event':
      return new EventPart(element, descriptor, context, host);
    case 'ref':
      return new RefPart(element, descriptor.name, host);
    case 'bind':
      return new BindPart(element, descriptor, context, host);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// TemplateInstance
// ---------------------------------------------------------------------------

export default class TemplateInstance {
  constructor(compiled, context, host, options = {}) {
    this.compiled = compiled;
    this.context = context;
    this.host = host;
    this.options = options;
    this.result = options.result || null;
    this.values = options.values || this.result?.values || [];

    this.fragment = compiled.template.content.cloneNode(true);
    this.parts = [];
    this.components = [];
    this.childrenRendered = [];
    this.rootNodes = [];

    const markers = collectMarkers(this.fragment);

    // Element groups first: components must exist before parts that target
    // their attributes are created.
    for (const group of compiled.elements) {
      const old = markers.elements.get(group.id);
      if (!old || !old.parentNode) continue;
      let element = old;

      if (group.component) {
        const component = createComponentElement(group.component, context, host, this);
        old.parentNode.replaceChild(component, old);
        element = component;
      }

      for (const descriptor of group.parts) {
        const part = createElementPart(element, descriptor, context, host, this.values);
        if (part) this.parts.push(part);
      }
    }

    // Child markers are independent: a ChildPart inserts nodes before its own
    // marker, so one structured value can never shift a sibling Part.
    for (const descriptor of compiled.childParts) {
      const anchor = markers.children.get(descriptor.id);
      if (anchor) {
        this.parts.push(new ChildPart(anchor, descriptor, context, host, this, this.values));
      }
    }

    this.rootNodes = Array.from(this.fragment.childNodes);
  }

  mount(container) {
    container.replaceChildren(this.fragment);
    this.fragment = null;
  }

  setResult(result) {
    this.result = result;
    this.setValues(result?.values || []);
  }

  setValues(values) {
    this.values = values || [];
    for (const part of this.parts) part.setValues?.(this.values);
    for (const {component} of this.components) {
      component._setTemplateValues?.(this.values);
    }
  }

  refreshRefs() {
    for (const part of this.parts) part.refresh?.();
  }

  getEventListenersCount() {
    let count = 0;
    for (const part of this.parts) {
      if (typeof part.listenerCount === 'function') count += part.listenerCount();
    }
    return count;
  }

  clearRendered() {
    for (const part of this.parts) part.clearRendered?.();
  }

  destroy() {
    for (const part of this.parts) part.destroy?.();
    this.parts = [];
    this.components = [];
    this.rootNodes = [];
    this.fragment = null;
  }
}
