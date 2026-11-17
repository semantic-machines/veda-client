/**
 * Security policy shared by the template compiler and the renderer.
 *
 * The rule the whole engine follows is the same one lit-html follows: values
 * are written through the DOM API, never parsed as template markup. Positions
 * that must become markup (tag names, `is`, attribute lists) are either
 * authored statically or explicitly trusted (`unsafeStatic()`).
 *
 * This module holds the few allow/deny lists that keep data from turning into
 * a capability: attribute names that only the framework may own, HTML sinks
 * that must go through `unsafeHTML()`, and URL schemes that execute script.
 */

export const ATTR_NAME_RE = /^[A-Za-z_:][A-Za-z0-9._:-]*$/;
export const ATTR_NAME_FRAGMENT_RE = /^[A-Za-z0-9._:-]+$/;
export const PROPERTY_NAME_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
export const EVENT_NAME_RE = /^[a-z][a-z0-9_-]*$/;

/** Element names a template interpolation may never create. */
export const DANGEROUS_ELEMENT_NAMES = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
]);

/**
 * Attributes that configure framework components. They are authored in the
 * template and must never arrive through a spread (`${attrs}`) from data:
 * `items`/`condition` are evaluated as JavaScript by Loop/If.
 */
export const FRAMEWORK_ATTRIBUTES = new Set([
  'condition', 'items', 'as', 'key', 'item-key',
  'height', 'item-height', 'overscan',
]);

/**
 * Attribute and property names that data may not set at all, because they
 * either configure the compiler/runtime (`bind`, `ref`, `is`, `about`,
 * `property`, `rel`, `slot`, framework attributes) or are HTML sinks
 * (`srcdoc`, `innerHTML`, event handler content attributes).
 */
export const FORBIDDEN_DATA_NAMES = new Set([
  ...FRAMEWORK_ATTRIBUTES,
  'about', 'bind', 'innerhtml', 'is', 'outerhtml', 'property', 'ref',
  'rel', 'slot', 'srcdoc',
]);

/** Attribute names whose string value is a URL. */
export const URL_ATTRIBUTES = new Set([
  'action', 'background', 'cite', 'data', 'formaction', 'href', 'longdesc',
  'manifest', 'poster', 'src', 'srcset', 'usemap', 'xlink:href',
]);

const SCRIPT_SCHEMES = new Set(['javascript:', 'vbscript:']);

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  const type = typeof value;
  if (type === 'object') return 'an object';
  return `a ${type}`;
}

/**
 * Normalize a URL the same way a browser does before it decides on a scheme:
 * leading/trailing controls and whitespace, tabs and newlines inside the
 * scheme, and ASCII case are all ignored by `javascript:` URLs.
 */
function normalizeUrl(value) {
  const text = String(value);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Browsers ignore leading controls/whitespace and newlines inside the
    // scheme, so `\n javascript:` must be recognized as `javascript:`.
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) continue;
    out += text[i];
  }
  return out.toLowerCase();
}

/** Reject `javascript:`/`vbscript:` values written to a URL attribute. */
export function assertSafeUrlValue(name, value) {
  if (!URL_ATTRIBUTES.has(name)) return;
  if (value == null) return;
  const url = normalizeUrl(value);
  for (const scheme of SCRIPT_SCHEMES) {
    if (url.startsWith(scheme)) {
      throw new Error(
        `Refusing to write a '${scheme}' URL to the "${name}" attribute. ` +
        'Sanitize the value or use a URL from a trusted source.',
      );
    }
  }
}

/** Validate an attribute name that arrives from data through a spread. */
export function assertSafeDataAttributeName(name) {
  if (typeof name !== 'string' || !ATTR_NAME_RE.test(name)) {
    throw new Error(`Invalid attribute name ${JSON.stringify(name)} in a ${'${attrs}'} value`);
  }
  const lower = name.toLowerCase();
  if (lower.startsWith('on') && lower.length > 2) {
    throw new Error(
      `Refusing to set the event handler attribute "${name}" from data; ` +
      'use @event syntax with a function instead',
    );
  }
  if (lower.startsWith('data-veda-')) {
    throw new Error(
      `Refusing to set the reserved attribute "${name}" from data; ` +
      'it belongs to the template engine',
    );
  }
  if (FORBIDDEN_DATA_NAMES.has(lower)) {
    throw new Error(
      `Refusing to set the framework attribute "${name}" from data; ` +
      'author it in the template',
    );
  }
}

/** Validate a property name that arrives from data through a spread. */
export function assertSafeDataPropertyName(name) {
  if (typeof name !== 'string' || !PROPERTY_NAME_RE.test(name)) {
    throw new Error(`Invalid property name ${JSON.stringify(name)} in a ${'${attrs}'} value`);
  }
  const lower = name.toLowerCase();
  if (lower.startsWith('on') && lower.length > 2) {
    throw new Error(
      `Refusing to set the event handler property "${name}" from data; ` +
      'use @event syntax with a function instead',
    );
  }
  if (FORBIDDEN_DATA_NAMES.has(lower)) {
    throw new Error(
      `Refusing to set the property "${name}" from data; ` +
      'use unsafeHTML() or author it in the template',
    );
  }
}

/**
 * Validate a `.prop` / `:prop` binding authored in a template.
 *
 * Setting `element.onclick = "..."` is the same inline-JS sink as a static
 * `onclick` attribute, so event handler properties on native elements are
 * refused. A component property such as `:on-save` is not a DOM handler and
 * stays allowed.
 */
export function assertSafePropertyBinding(name, element) {
  const lower = String(name).toLowerCase();
  if (lower === 'srcdoc' || lower === 'innerhtml' || lower === 'outerhtml') {
    throw new Error(
      `The ":${name}" binding is not supported; HTML sinks must go through unsafeHTML()`,
    );
  }
  if (lower.startsWith('on') && lower.length > 2 && element) {
    const isNative = !element.tagName?.includes('-') && !element.hasAttribute?.('is');
    if (isNative && name in element) {
      throw new Error(
        `The ":${name}" binding is not supported; use on{event}="{expression}" for handlers`,
      );
    }
  }
}

/** Describe a value for compiler error messages. */
export function describeValue(value) {
  return describe(value);
}
