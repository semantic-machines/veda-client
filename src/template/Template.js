import {
  isTemplateResult, isUnsafeStatic, nothing, noChange,
} from './TemplateResult.js';
import {
  ELEMENT_MARKER, SPREAD_MARKER_PREFIX, TEXT_MARKER_PREFIX, TEXT_MARKER_SUFFIX,
  isSpreadMarker, spreadValueIndexOf,
} from './markers.js';
import {
  ATTR_NAME_FRAGMENT_RE, ATTR_NAME_RE, DANGEROUS_ELEMENT_NAMES, FRAMEWORK_ATTRIBUTES,
  assertSafePropertyBinding, describeValue,
} from './security.js';
import TemplateInstance from './TemplateInstance.js';

export const TOKEN_PREFIX = '\uE000';

// Diagnostic engine marker (stable across the 4.x line).
export const TEMPLATE_ENGINE = 'templateresult-parts-v3';
export const TOKEN_SUFFIX = '\uE001';

const TOKEN_AT_START = new RegExp(`^${TOKEN_PREFIX}(\\d+)${TOKEN_SUFFIX}`);

// A marker attribute groups every Part that belongs to one element. It is
// generated at compile time and removed when the instance resolves the Part.

const RAW_TEXT_TAGS = new Set(['script', 'style']);
const RCDATA_TAGS = new Set(['textarea', 'title']);
const FRAMEWORK_ATTRS = FRAMEWORK_ATTRIBUTES;

// Trusted Types: the compiled template source is developer-authored markup, so
// it is safe by construction (lit-html does the same with its `lit-html`
// policy). This keeps the engine working under
// `require-trusted-types-for 'script'` instead of throwing on innerHTML.
const trustedTypes = globalThis.trustedTypes;
const templatePolicy = trustedTypes?.createPolicy?.('veda-template', {
  createHTML: (source) => source,
});

export function trustedHTML(source) {
  return templatePolicy ? templatePolicy.createHTML(source) : source;
}

const MAX_STRING_CACHE = 1000;
const MAX_SHAPE_CACHE = 20;

const stringCache = new Map();
let resultCache = new WeakMap();
// Per call-site source + token classification. Fold modes depend only on the
// template source (and type), not on the interpolated values, so the full HTML
// scan can be skipped on cache hits.
let sourceCache = new WeakMap();

function token(index) {
  return `${TOKEN_PREFIX}${index}${TOKEN_SUFFIX}`;
}

function isTokenAt(source, index) {
  return source.charCodeAt(index) === 0xE000;
}

function readTokenAt(source, index) {
  const match = TOKEN_AT_START.exec(source.slice(index));
  if (!match) return null;
  return {
    index: Number(match[1]),
    text: match[0],
    end: index + match[0].length,
  };
}

const TAG_NAME_RE = /^[A-Za-z][A-Za-z0-9._:-]*$/;
const TAG_NAME_FRAGMENT_RE = /^[A-Za-z0-9._:-]+$/;
const CUSTOM_ELEMENT_RE = /^[a-z][a-z0-9._-]*-[a-z0-9._-]*$/i;

// A DOM element exposes its event handler content attributes as IDL properties
// (`onclick`, `onerror`, ...). Checking the property avoids treating ordinary
// attributes that merely start with "on" (once, ontology) as handlers.
//
// Custom events have no IDL property, so `ontab-change="{handler}"` (the form
// produced by the JSX bridge for `on:tab-change`) must be recognized by name.
// Restrict that fallback to hyphenated names: `once`, `ontology`, and similar
// ordinary attributes stay attributes, while `tab-change` / `model-change`
// keep working like they did before the template-engine rewrite.
function isEventHandlerAttribute(element, name) {
  if (!name.startsWith('on') || name.length <= 2) return false;
  // Explicit `on:event` form works for both DOM and custom events.
  if (name.startsWith('on:')) return name.length > 3;
  if (name in element) return true;
  return name.includes('-');
}

function eventNameFromAttribute(name) {
  return (name.startsWith('on:') ? name.slice(3) : name.slice(2)).toLowerCase();
}

// ---------------------------------------------------------------------------
// Static-trusted values
//
// A `${}` in a name position would have to become template markup. That is only
// safe for values that are authored code, so the compiler accepts exactly two
// forms, mirroring lit-html's static.js:
//
//   - a Component class (it carries `static tag`);
//   - an explicit `unsafeStatic('name')` wrapper. Its value is branded with a
//     symbol, so ordinary data - including anything produced by `JSON.parse` -
//     can never be mistaken for it.
//
// Every other value is a compile error. Data never becomes markup.
// ---------------------------------------------------------------------------

function staticValueText(value) {
  if (isUnsafeStatic(value)) return String(value.value ?? '');
  // Only a class that declares its own `static tag` is a tag name. Reading an
  // inherited tag (every Component subclass inherits `veda-component`) would
  // silently compile a wrong element, so it is not accepted.
  if (
    typeof value === 'function' &&
    Object.prototype.hasOwnProperty.call(value, 'tag') &&
    typeof value.tag === 'string'
  ) {
    return value.tag;
  }
  return null;
}

function tagNameFromStatic(value) {
  const text = staticValueText(value);
  if (text === null) {
    if (typeof value === 'function') {
      throw new Error(
        `Dynamic tag names are not supported: component class ` +
        `'${value.name || '(anonymous)'}' has no own "static tag". ` +
        `Add "static tag = 'my-el'" or use unsafeStatic('my-el').`
      );
    }
    throw new Error(
      `Dynamic tag names are not supported (got ${describeValue(value)}). ` +
      `Use a Component class or unsafeStatic('name').`
    );
  }
  if (!TAG_NAME_RE.test(text)) {
    throw new Error(
      `Invalid dynamic tag name '${text}': expected an element name, not markup`
    );
  }
  if (DANGEROUS_ELEMENT_NAMES.has(text.toLowerCase())) {
    throw new Error(
      `The tag '${text}' cannot be created from a template interpolation; ` +
      'build it imperatively or use unsafeHTML() for trusted markup'
    );
  }
  return text;
}

function tagNameFragmentFromStatic(value) {
  const text = staticValueText(value);
  if (text === null) {
    throw new Error(
      `Dynamic tag name fragments are not supported (got ${describeValue(value)}). ` +
      `Use unsafeStatic('name') or author the tag name.`
    );
  }
  if (!TAG_NAME_FRAGMENT_RE.test(text)) {
    throw new Error(
      `Invalid dynamic tag name fragment '${text}': expected name characters only`
    );
  }
  return text;
}

// `is` selects the element class. A `${}` value there must be a Component class
// or unsafeStatic(); a plain string could let data pick a registered component,
// so it is rejected. Static author values are still validated below.
function declarationFromStatic(value) {
  const text = staticValueText(value);
  if (text === null) {
    throw new Error(
      `The "is" attribute requires a Component class or unsafeStatic('name') ` +
      `(got ${describeValue(value)}).`
    );
  }
  if (!CUSTOM_ELEMENT_RE.test(text)) {
    throw new Error(
      `Invalid is="${text}": expected a custom element tag name or a Component class with static tag`
    );
  }
  return text;
}

// `is` selects the element class, so it cannot be a Part. A Component class is
// accepted because it carries `static tag`; a string is accepted only when it
// is a valid custom-element name. This prevents attribute injection through a
// single-quoted or unquoted `is`.
function declarationValue(value) {
  let text;
  if (typeof value === 'function' && typeof value.tag === 'string') {
    text = value.tag;
  } else {
    text = value == null ? '' : String(value);
  }
  if (!CUSTOM_ELEMENT_RE.test(text)) {
    throw new Error(
      `Invalid is="${text}": expected a custom element tag name or a Component class with static tag`
    );
  }
  return text;
}

/**
 * Replace `${}` interpolations with internal tokens.
 */
function buildTokenizedSource(strings, values) {
  const sourceParts = [];
  const tokenMap = new Map();
  const length = Math.max(strings.length, values.length + 1);
  for (let i = 0; i < length; i++) {
    sourceParts.push(strings[i] ?? '');
    if (i < values.length) {
      sourceParts.push(token(i));
      tokenMap.set(i, values[i]);
    }
  }
  return {source: sourceParts.join(''), tokenMap};
}

/**
 * Classify every `${}` token by its syntactic position.
 *
 * The rule is the same one lit-html follows: a value is never spliced into
 * template markup. Only static-trusted values (a Component class, or an
 * explicit `unsafeStatic()` value) may resolve to a tag name; everything else
 * becomes a Part and is written through the DOM API.
 *
 * Positions:
 *   - text / attribute value          -> dynamic Part
 *   - tag name (`<${Comp}>`)          -> static-trusted name, validated
 *   - `is="..."` value                -> static-trusted declaration, validated
 *   - attribute-name start (`${attrs}`) -> spread slot, applied from an object
 *   - inside an attribute name        -> compile error
 *   - comment / script / style / nested <template> -> compile error
 *
 * This is intentionally a small HTML-aware scanner, not a full parser. It only
 * needs to know whether a token is inside a tag (and if so, in which position).
 */
function classifyTemplateSource(source, tokenMap) {
  const modes = new Map();
  // True when a token sits in an attribute-name position: whether it becomes a
  // static name or a spread slot depends on the value, so the classification
  // must not be cached for that call site.
  let valueDependent = false;
  let out = '';
  let i = 0;
  let inTag = false;
  let tagStart = false;
  let quote = null;
  let attrName = '';
  let inAttrName = false;
  let expectingValue = false;
  let readingValue = false;
  let inComment = false;
  let rawTextTag = null;
  let pendingRawTextTag = null;

  const emitDynamic = (tokenInfo) => {
    out += tokenInfo.text;
    modes.set(tokenInfo.index, 'dynamic');
  };

  const emitStatic = (tokenInfo, text) => {
    out += text;
    modes.set(tokenInfo.index, 'static');
  };

  const emitSpread = (tokenInfo) => {
    // A placeholder attribute keeps the spread inside the compiled <template>.
    // It is generated with a random prefix and removed when the Part resolves.
    // The suffix is the interpolation index so the Part reads its own value
    // even when other `${}` values precede it.
    out += `${SPREAD_MARKER_PREFIX}${tokenInfo.index}=""`;
    modes.set(tokenInfo.index, 'spread');
  };

  const dynamicAttributeName = (name) => {
    throw new Error(
      `Dynamic attribute names are not supported ('${name}'). ` +
      'Author the attribute name, or pass an object to ${attrs}.'
    );
  };

  while (i < source.length) {
    if (inComment) {
      if (source.startsWith('-->', i)) {
        inComment = false;
        out += '-->';
        i += 3;
        continue;
      }
      const tokenInfo = isTokenAt(source, i) ? readTokenAt(source, i) : null;
      if (tokenInfo) {
        throw new Error(
          'Expressions inside HTML comments are not supported; render a text node instead'
        );
      }
      out += source[i++];
      continue;
    }

    if (rawTextTag) {
      if (source[i] === '<' && source.slice(i).toLowerCase().startsWith(`</${rawTextTag}`)) {
        rawTextTag = null;
        // fall through to normal tag handling below
      } else {
        const tokenInfo = isTokenAt(source, i) ? readTokenAt(source, i) : null;
        if (tokenInfo) {
          throw new Error(
            `Expressions inside <${rawTextTag}> are not supported; build the node imperatively`
          );
        }
        out += source[i++];
        continue;
      }
    }

    // The quote check must come before comment detection: `<!--` inside an
    // attribute value is data, not an HTML comment.
    if (quote) {
      if (source[i] === quote) {
        quote = null;
        out += source[i++];
        continue;
      }
      const tokenInfo = isTokenAt(source, i) ? readTokenAt(source, i) : null;
      if (tokenInfo) {
        if (attrName.toLowerCase() === 'is') {
          emitStatic(tokenInfo, declarationFromStatic(tokenMap.get(tokenInfo.index)));
        } else {
          emitDynamic(tokenInfo);
        }
        i = tokenInfo.end;
        continue;
      }
      out += source[i++];
      continue;
    }

    if (source.startsWith('<!--', i)) {
      inComment = true;
      out += '<!--';
      i += 4;
      continue;
    }

    if (inTag) {
      const char = source[i];
      if (char === '>') {
        inTag = false;
        tagStart = false;
        attrName = '';
        inAttrName = false;
        expectingValue = false;
        readingValue = false;
        if (pendingRawTextTag) {
          rawTextTag = pendingRawTextTag;
          pendingRawTextTag = null;
        }
        out += char;
        i++;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        expectingValue = false;
        readingValue = false;
        out += char;
        i++;
        continue;
      }
      if (char === '/' && source[i + 1] === '>') {
        inTag = false;
        tagStart = false;
        attrName = '';
        inAttrName = false;
        expectingValue = false;
        readingValue = false;
        pendingRawTextTag = null;
        out += '/>';
        i += 2;
        continue;
      }
      if (/\s/.test(char)) {
        // Whitespace ends an unquoted value. Spaces immediately after `=` are
        // allowed (`attr = value`), so only clear expectingValue once a value
        // has actually started. Keep the name while a value is still expected,
        // so `is = ${...}` is still recognised as the declaration attribute.
        tagStart = false;
        if (readingValue) {
          readingValue = false;
          expectingValue = false;
        }
        inAttrName = false;
        if (!expectingValue) attrName = '';
        out += char;
        i++;
        continue;
      }
      const tokenInfo = isTokenAt(source, i) ? readTokenAt(source, i) : null;
      if (tokenInfo) {
        const isValue = expectingValue;
        expectingValue = false;
        if (isValue) {
          if (attrName.toLowerCase() === 'is') {
            emitStatic(tokenInfo, declarationFromStatic(tokenMap.get(tokenInfo.index)));
          } else {
            // Unquoted attribute value: keep the token so AttributePart escapes
            // it through the DOM instead of splicing markup.
            emitDynamic(tokenInfo);
          }
        } else if (readingValue) {
          // A token spliced into an unquoted literal value, e.g. foo${bar}.
          emitDynamic(tokenInfo);
        } else if (tagStart) {
          const fragment = attrName !== '' && attrName !== '/';
          emitStatic(
            tokenInfo,
            fragment
              ? tagNameFragmentFromStatic(tokenMap.get(tokenInfo.index))
              : tagNameFromStatic(tokenMap.get(tokenInfo.index)),
          );
        } else {
          // Attribute-name position. A static-trusted value (unsafeStatic, or
          // a Component class for the whole name) is a name; anything else is
          // a `${attrs}` spread slot. A token that is only part of a name, or
          // that is followed by `=`, must be static: data never names an
          // attribute.
          const value = tokenMap.get(tokenInfo.index);
          const staticName = staticValueText(value);
          valueDependent = true;
          if (attrName !== '') {
            if (staticName === null || !ATTR_NAME_FRAGMENT_RE.test(staticName)) {
              dynamicAttributeName(`${attrName}${describeValue(value)}`);
            }
            emitStatic(tokenInfo, staticName);
          } else if (staticName !== null) {
            if (!ATTR_NAME_RE.test(staticName)) dynamicAttributeName(staticName);
            emitStatic(tokenInfo, staticName);
          } else {
            // `${attrs}` is only recognised as a whole slot: `foo${x}` and
            // `${x}="v"` are attribute-name interpolation and stay unsupported.
            const next = source[tokenInfo.end] ?? '';
            if (next !== '' && !/\s/.test(next) && next !== '>' && next !== '/') {
              dynamicAttributeName(describeValue(value));
            }
            emitSpread(tokenInfo);
          }
        }
        readingValue = false;
        i = tokenInfo.end;
        continue;
      }
      if (char === '=') {
        inAttrName = false;
        expectingValue = true;
        readingValue = false;
        out += char;
        i++;
        continue;
      }
      if (expectingValue) {
        // First character of an unquoted value.
        readingValue = true;
        expectingValue = false;
        out += char;
        i++;
        continue;
      }
      if (readingValue) {
        out += char;
        i++;
        continue;
      }
      if (!inAttrName) {
        inAttrName = true;
        attrName = '';
      }
      attrName += char;
      out += char;
      i++;
      continue;
    }

    if (source[i] === '<') {
      const next = source[i + 1];
      // A lone `<` in text (e.g. "1 < 2") is not a tag start. Without this
      // check the scanner would treat following `${}` as static markup.
      const startsTag = next &&
        (/[A-Za-z]/.test(next) || next === '/' || next === '!' || next === '?' || isTokenAt(source, i + 1));
      if (!startsTag) {
        out += source[i++];
        continue;
      }
      const rest = source.slice(i);
      const rawMatch = rest.match(/^<(script|style)(?=[\s>])/i);
      inTag = true;
      tagStart = true;
      inAttrName = false;
      expectingValue = false;
      readingValue = false;
      attrName = '';
      if (rawMatch) pendingRawTextTag = rawMatch[1].toLowerCase();
      out += '<';
      i++;
      continue;
    }

    const tokenInfo = isTokenAt(source, i) ? readTokenAt(source, i) : null;
    if (tokenInfo) {
      emitDynamic(tokenInfo);
      i = tokenInfo.end;
      continue;
    }

    out += source[i++];
  }

  return {foldedSource: out, modes, valueDependent};
}

const EXPR_OPEN = '{';
const EXPR_CLOSE = '}';

function parseSegments(text, tokenMap, options = {}) {
  const segments = [];
  let staticText = '';
  let i = 0;

  const pushStatic = () => {
    if (staticText) {
      segments.push({type: 'static', value: staticText});
      staticText = '';
    }
  };

  while (i < text.length) {
    if (isTokenAt(text, i)) {
      const tokenInfo = readTokenAt(text, i);
      if (tokenInfo) {
        pushStatic();
        const value = tokenMap.get(tokenInfo.index);
        if (options.bakeValues) {
          segments.push({type: 'constant', value});
        } else {
          segments.push({type: 'value', index: tokenInfo.index});
        }
        i = tokenInfo.end;
        continue;
      }
    }

    if (text[i] === EXPR_OPEN) {
      const close = text.indexOf(EXPR_CLOSE, i + 1);
      if (close !== -1) {
        pushStatic();
        segments.push({type: 'expr', code: text.slice(i + 1, close).trim()});
        i = close + 1;
        continue;
      }
    }

    staticText += text[i++];
  }

  pushStatic();
  return segments;
}

function hasDynamicSegments(segments) {
  return segments.some(segment => segment.type !== 'static');
}

function segmentsHaveExpressions(segments) {
  return segments.some(segment => segment.type === 'expr');
}

// Nested <template> content is inert and is not walked by the marker engine, so
// it must not contain Parts. It is still validated: a static `on*` handler or
// `srcdoc` inside a template is the same HTML sink as anywhere else, and the
// engine promises those are compile errors.
function validateInertTemplate(element) {
  if (element.innerHTML.includes(TOKEN_PREFIX)) {
    throw new Error('Expressions inside a nested <template> are not supported');
  }
  const check = (root) => {
    for (const node of root.querySelectorAll('*')) {
      for (const attr of node.attributes) {
        if (attr.name === 'srcdoc') {
          throw new Error(
            'The "srcdoc" attribute is not supported in templates; use unsafeHTML() or set it imperatively'
          );
        }
        if (isEventHandlerAttribute(node, attr.name)) {
          throw new Error(`The "${attr.name}" handler must use {expression}, not a static value`);
        }
      }
      if (node.tagName.toLowerCase() === 'template') check(node.content);
    }
  };
  check(element.content);
}

/**
 * Compiled template: static DOM skeleton + marker-based Part descriptors.
 */
export class CompiledTemplate {
  /**
   * @param {HTMLTemplateElement} template
   * @param {object} meta
   */
  constructor(template, meta = {}) {
    this.template = template;
    this.meta = meta;
    this.source = meta.source || template.innerHTML;
    this.type = meta.type || 'html';
    // Element groups: one entry per element that owns a Component replacement
    // and/or Attribute/Property/Event/Ref/Bind parts.
    this.elements = [];
    // Child markers: one entry per dynamic text position.
    this.childParts = [];
    // Per call-site token classification ('dynamic' | 'static' | 'spread').
    // It depends only on the template source, not on the interpolated values.
    this.modes = meta.modes || new Map();
  }

  instantiate(context, host, options) {
    return new TemplateInstance(this, context, host, options);
  }
}

function replaceTextNode(node, segments, compiled, nextId, rcdata) {
  const replacement = [];
  for (const segment of segments) {
    if (segment.type === 'static') {
      if (segment.value) replacement.push(document.createTextNode(segment.value));
      continue;
    }
    const id = nextId();
    // A text-node marker is stable through cloning, is not serialized as a
    // visible comment, and can be found again without paths. RCDATA elements
    // use the marker node itself; regular children insert values before it.
    replacement.push(document.createTextNode(`${TEXT_MARKER_PREFIX}${id}${TEXT_MARKER_SUFFIX}`));
    compiled.childParts.push({id, segment, anchor: rcdata ? 'text' : 'node'});
  }
  node.replaceWith(...replacement);
}

function processAttributes(element, partList, tokenMap, isComponent, staticAttrs, isFrameworkComponent) {
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name;
    const value = attr.value;
    const hasToken = value.includes(TOKEN_PREFIX);
    const hasExpr = value.includes(EXPR_OPEN);

    // `${attrs}` in the attribute-name position. The value is applied as an
    // object through the DOM API, never parsed as markup.
    if (isSpreadMarker(name)) {
      element.removeAttribute(name);
      partList.push({type: 'spread', valueIndex: spreadValueIndexOf(name)});
      continue;
    }

    if (isComponent && isFrameworkComponent && FRAMEWORK_ATTRS.has(name)) {
      if (hasToken) {
        throw new Error(
          `The "${name}" attribute does not support \${} values; use {expression} instead`
        );
      }
      staticAttrs.push([name, value]);
      continue;
    }

    if (name === 'is') {
      if (hasToken) {
        throw new Error('The "is" attribute must be a static value or a Component class');
      }
      staticAttrs?.push([name, declarationValue(value)]);
      continue;
    }

    if (name === 'ref') {
      if (hasToken) throw new Error('The "ref" attribute does not support ${} values');
      element.removeAttribute(name);
      partList.push({type: 'ref', name: value.trim()});
      continue;
    }

    if (name === 'bind') {
      if (hasToken) throw new Error('The "bind" attribute does not support ${} values');
      const expr = value.match(/^\{([^}]+)\}$/)?.[1]?.trim();
      element.removeAttribute(name);
      if (expr) partList.push({type: 'bind', expr});
      continue;
    }

    if (name.startsWith(':')) {
      const propName = name.slice(1).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      // HTML sinks and event handler properties have no safe Part form; the
      // same policy as `srcdoc` below applies before the Part is created.
      assertSafePropertyBinding(propName, element);
      const segments = parseSegments(value, tokenMap);
      element.removeAttribute(name);
      if (hasDynamicSegments(segments)) {
        partList.push({
          type: 'property',
          name: propName,
          segments,
          expression: segmentsHaveExpressions(segments),
        });
      }
      continue;
    }

    if (name === 'srcdoc') {
      // srcdoc is parsed as HTML by the browser, so even a dynamic value would
      // be a markup insertion point. It has no safe Part representation.
      throw new Error(
        'The "srcdoc" attribute is not supported in templates; use unsafeHTML() or set it imperatively'
      );
    }

    if (isEventHandlerAttribute(element, name)) {
      if (hasToken) {
        throw new Error(`The "${name}" handler must use {expression}, not \${} values`);
      }
      if (!hasExpr) {
        // Static inline JavaScript is unsafe under CSP and, more importantly,
        // can be smuggled in through a folded ${} attribute name/value. Only
        // the authored {expression} form is accepted.
        throw new Error(`The "${name}" handler must use {expression}, not a static value`);
      }
      const eventName = eventNameFromAttribute(name);
      const expr = value.replace(/[{}]/g, '').trim();
      element.removeAttribute(name);
      partList.push({type: 'event', eventName, expr});
      continue;
    }

    if (!hasToken && !hasExpr) {
      staticAttrs?.push([name, value]);
      continue;
    }

    const segments = parseSegments(value, tokenMap);
    if (!hasDynamicSegments(segments)) {
      // A token cannot survive as a static attribute value: static-trusted
      // tokens are folded into the source at compile time. Reaching this
      // branch means a leftover interpolation token reached the compiler.
      throw new Error(`Unresolved \${} value in the "${name}" attribute`);
    }

    element.removeAttribute(name);
    partList.push({
      type: 'attribute',
      name,
      segments,
      mode: isComponent ? 'component' : 'native',
      expression: segmentsHaveExpressions(segments),
    });
  }
}

function compileSource(source, tokenMap, options = {}) {
  const type = options.type || 'html';

  const folded = options.foldedSource != null
    ? {foldedSource: options.foldedSource, modes: options.modes || new Map()}
    : classifyTemplateSource(source, tokenMap);
  const {foldedSource, modes} = folded;
  const template = document.createElement('template');
  template.innerHTML = trustedHTML(foldedSource);

  const compiled = new CompiledTemplate(template, {
    source: foldedSource,
    type,
    modes,
  });

  let idCounter = 0;
  const nextId = () => ++idCounter;

  const walk = (parent, parentTag, skipText) => {
    const children = Array.from(parent.childNodes);
    for (const node of children) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (RAW_TEXT_TAGS.has(parentTag)) {
          // JS/CSS braces are not Veda expressions. Only an actual ${} token
          // is rejected here; static script/style text stays untouched.
          if (node.nodeValue.includes(TOKEN_PREFIX)) {
            throw new Error(`Expressions inside <${parentTag}> are not supported`);
          }
          continue;
        }
        if (skipText) continue;
        const segments = parseSegments(node.nodeValue, tokenMap);
        if (!hasDynamicSegments(segments)) continue;
        replaceTextNode(node, segments, compiled, nextId, RCDATA_TAGS.has(parentTag));
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const el = node;
      const tag = el.tagName.toLowerCase();

      if (tag === 'template') {
        validateInertTemplate(el);
        continue;
      }

      const hasDash = tag.includes('-');
      const hasIs = el.hasAttribute('is');
      const hasProp = el.hasAttribute('property');
      const hasRel = el.hasAttribute('rel');
      const hasAbout = el.hasAttribute('about');
      // `items`/`condition` upgrade a *native* element into a semantic Loop/If.
      // On a custom element they are ordinary attributes, so data cannot turn a
      // user component into a framework component (and vice versa).
      const hasItems = !hasDash && !hasIs && el.hasAttribute('items');
      const hasCondition = !hasDash && !hasIs && !hasItems && el.hasAttribute('condition');
      const isComponent = hasDash || hasIs || hasProp || hasRel || hasAbout || hasItems || hasCondition;

      if (isComponent) {
        const childSource = el.innerHTML;
        const childCompiled = childSource.trim()
          ? compileSource(childSource, tokenMap, {type})
          : null;
        // Child content is rendered by the child component. Keep the parent
        // template free of it, so parent parts never see child internals.
        el.innerHTML = trustedHTML('');

        const kind = hasDash
          ? 'custom'
          : hasIs
            ? 'is'
            : hasProp
              ? 'property'
              : hasRel
                ? 'rel'
                : hasItems
                  ? 'items'
                  : hasCondition
                    ? 'condition'
                    : 'about';

        const group = {id: nextId(), component: null, parts: []};
        const staticAttrs = [];
        // Attribute names like `key`/`as`/`height` are framework config only on
        // Loop/If/Virtual; on a user component they are ordinary attributes.
        const isAttr = el.getAttribute('is') || '';
        const isFrameworkComponent = hasItems || hasCondition ||
          tag === 'veda-loop' || tag === 'veda-if' || tag === 'veda-virtual' ||
          /-(loop|if)-component$/.test(isAttr);
        processAttributes(el, group.parts, tokenMap, true, staticAttrs, isFrameworkComponent);

        group.component = {
          kind,
          tag,
          is: el.getAttribute('is') || null,
          elementClass: el.constructor,
          staticAttrs,
          childCompiled,
          // Raw author content with its `${}` tokens intact. Slot projection
          // compiles it with the component values instead of re-parsing the
          // baked legacy string, so values never become markup.
          childSource,
          hasDash,
          hasIs,
          hasProp,
          hasRel,
          hasAbout,
          hasItems,
          hasCondition,
        };

        el.setAttribute(ELEMENT_MARKER, String(group.id));
        compiled.elements.push(group);
        continue;
      }

      const group = {id: nextId(), component: null, parts: []};
      processAttributes(el, group.parts, tokenMap, false, null);
      if (group.parts.length) {
        el.setAttribute(ELEMENT_MARKER, String(group.id));
        compiled.elements.push(group);
      }

      walk(el, tag, RAW_TEXT_TAGS.has(tag));
    }
  };

  walk(template.content, '', false);

  return compiled;
}

function shapeKey(values, type, modes) {
  const key = [type];
  for (let i = 0; i < values.length; i++) {
    const mode = modes.get(i);
    // Only a static-trusted value changes the compiled markup; it is part of
    // the shape. Dynamic and spread values never do.
    const staticText = mode === 'static' ? staticValueText(values[i]) : null;
    key.push([i, mode, staticText]);
  }
  // JSON keeps static values unambiguous: a value containing `;` or `:` must
  // not be able to collide with a different shape and reuse its template.
  return JSON.stringify(key);
}

function trimCache(cache, max) {
  while (cache.size > max) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
}

/**
 * Compile a TemplateResult, a CompiledTemplate, or a plain HTML string.
 * @param {TemplateResult|CompiledTemplate|string|undefined|null} input
 * @param {object} [options]
 * @returns {CompiledTemplate}
 */
export function compileTemplate(input) {
  if (input instanceof CompiledTemplate) return input;

  if (isTemplateResult(input)) {
    const strings = input.strings;
    const type = input.type;

    // html('...') is a plain string: use the string cache instead of
    // compiling a fresh template for every call.
    if (typeof strings === 'string') {
      if (input.values.length) {
        throw new Error('html() with a plain string does not support ${} values');
      }
      return compileTemplate(strings);
    }

    const canCache = strings && (typeof strings === 'object' || typeof strings === 'function');
    let stringsEntry = canCache ? sourceCache.get(strings) : null;
    if (stringsEntry && stringsEntry.type !== type) stringsEntry = null;

    let source = stringsEntry?.source;
    let modes = stringsEntry?.modes;
    let foldedSource = null;
    let tokenMap = null;

    if (!stringsEntry) {
      const built = buildTokenizedSource(strings, input.values);
      source = built.source;
      tokenMap = built.tokenMap;
      const classified = classifyTemplateSource(source, tokenMap);
      modes = classified.modes;
      foldedSource = classified.foldedSource;
      // A call site with an attribute-name position is classified per value,
      // so only value-independent sources are cached here.
      if (canCache && !classified.valueDependent) {
        sourceCache.set(strings, {type, source, modes});
      }
    }

    const shape = shapeKey(input.values, type, modes);

    let perStrings = null;
    if (canCache) {
      perStrings = resultCache.get(strings);
      if (!perStrings) {
        perStrings = new Map();
        resultCache.set(strings, perStrings);
      }
    }
    const cached = perStrings?.get(shape);
    if (cached) {
      perStrings.delete(shape);
      perStrings.set(shape, cached);
      return cached;
    }

    if (!foldedSource) {
      tokenMap = new Map(input.values.map((value, index) => [index, value]));
      foldedSource = classifyTemplateSource(source, tokenMap).foldedSource;
    }
    const compiled = compileSource(source, tokenMap, {
      type,
      foldedSource,
      modes,
    });
    if (perStrings) {
      perStrings.set(shape, compiled);
      trimCache(perStrings, MAX_SHAPE_CACHE);
    }
    return compiled;
  }

  const stringSource = typeof input === 'string' ? input : '';
  if (typeof input !== 'string' && input != null) {
    return compileTemplate(String(input));
  }

  const cached = stringCache.get(stringSource);
  if (cached) {
    stringCache.delete(stringSource);
    stringCache.set(stringSource, cached);
    return cached;
  }

  const compiled = compileSource(stringSource, new Map(), {type: 'html'});
  stringCache.set(stringSource, compiled);
  trimCache(stringCache, MAX_STRING_CACHE);
  return compiled;
}

export function clearTemplateCache() {
  stringCache.clear();
  resultCache = new WeakMap();
  sourceCache = new WeakMap();
}

/**
 * @deprecated Runtime counters were removed in 4.0; kept as a no-op for API
 * compatibility. Use `clearTemplateCache()` to reset the cache between tests.
 */
export function resetTemplateStats() {}


const ROOT_PART = Symbol.for('veda.rootPart');

/**
 * Render a TemplateResult into a container, reusing the mounted instance when
 * the compiled template is unchanged. This is the Lit-style standalone entry
 * point; Components use the same TemplateInstance internally.
 *
 * @param {TemplateResult|CompiledTemplate|string|null|undefined} result
 * @param {Element|DocumentFragment|ShadowRoot} container
 * @returns {TemplateInstance|null}
 */
export function render(result, container) {
  if (result === noChange) return container[ROOT_PART] || null;
  if (result === nothing || result == null) {
    container[ROOT_PART]?.destroy();
    container.replaceChildren();
    container[ROOT_PART] = null;
    return null;
  }

  const compiled = compileTemplate(result);
  let root = container[ROOT_PART];
  if (root && root.compiled === compiled) {
    root.setResult(typeof result === 'string' ? {values: []} : result);
    return root;
  }

  root?.destroy();
  root = compiled.instantiate(container, container, {result});
  root.mount(container);
  container[ROOT_PART] = root;
  return root;
}

/**
 * Remaining template-cache diagnostics. The per-host/per-tag counters and the
 * DOM-write accounting were removed in 4.0; only the engine marker and the
 * size of the string cache are still reported.
 *
 * @deprecated Prefer `clearTemplateCache()` and structural tests.
 */
export function getTemplateCacheStats() {
  return {engine: TEMPLATE_ENGINE, stringCacheSize: stringCache.size};
}

if (typeof window !== 'undefined') {
  window.__VEDA_TEMPLATE_ENGINE__ = TEMPLATE_ENGINE;
}
