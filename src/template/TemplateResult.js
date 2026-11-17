/**
 * TemplateResult: a Lit-like template value.
 *
 * `html` returns a TemplateResult object. It is intentionally not a String
 * subclass: rendering goes through the template engine, never through
 * `innerHTML`, and there is no string serialization of a template. Use
 * `render()` or return the result from `Component.render()`.
 *
 * `{expr}` inside the static parts remains the Veda reactive expression
 * syntax. `${value}` interpolations become template values.
 */

const HTML_ESCAPE_MAP = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  "'": '&#39;', '/': '&#x2F;', '\\': '&#x5C;', '`': '&#x60;',
};
const HTML_ESCAPE_REGEX = /[&<>"'/\\`]/g;
const SAFE_EXPR_REGEX = /\{[^}]*\}/g;

/**
 * Sentinel: render nothing at this position.
 */
export const nothing = Symbol.for('veda.nothing');
/**
 * Sentinel: keep the previous value of this Part.
 */
export const noChange = Symbol.for('veda.noChange');

const UNSAFE_HTML = Symbol.for('veda.unsafeHTML');
const UNSAFE_STATIC = Symbol.for('veda.unsafeStatic');

/**
 * Trusted markup. Use only with trusted content; values are inserted as DOM.
 * @param {unknown} value
 */
export function unsafeHTML(value) {
  return {[UNSAFE_HTML]: true, value};
}

export function isUnsafeHTML(value) {
  return Boolean(value && value[UNSAFE_HTML] === true);
}

/**
 * Treat a string as part of the static template source, like lit-html's
 * `unsafeStatic()`. The value is spliced into the template markup before it is
 * parsed, so it may only be used with trusted content (never user input).
 *
 * The value is branded with a symbol so ordinary data - including anything that
 * went through `JSON.parse` - can never be mistaken for a static value. This is
 * the same approach as lit-html's `static.ts`; see TEMPLATE_ENGINE.md.
 *
 * @param {unknown} value
 * @returns {{[key: symbol]: true, value: string}}
 */
export function unsafeStatic(value) {
  return {[UNSAFE_STATIC]: true, value: value == null ? '' : String(value)};
}

export function isUnsafeStatic(value) {
  return Boolean(value && value[UNSAFE_STATIC] === true);
}

export function safe(value) {
  if (Array.isArray(value)) return value.map(safe);
  if (typeof value !== 'string' && !(value instanceof String)) return value;
  return String(value)
    .replace(HTML_ESCAPE_REGEX, char => HTML_ESCAPE_MAP[char])
    .replace(SAFE_EXPR_REGEX, '');
}

function rawValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(rawValue).join(' ');
  return String(value);
}

function rawStrings(strings, values) {
  if (typeof strings === 'string') {
    let result = strings;
    for (const value of values) result += rawValue(value);
    return result.trimEnd();
  }
  let result = '';
  const count = Math.max(strings.length, values.length + 1);
  for (let i = 0; i < count; i++) {
    result += strings[i] ?? '';
    if (i < values.length) result += rawValue(values[i]);
  }
  return result.trimEnd();
}

export class TemplateResult {
  /**
   * @param {TemplateStringsArray|readonly string[]|string} strings
   * @param {any[]} values
   * @param {'html'|'raw'} [type]
   */
  constructor(strings, values, type = 'html') {
    this.strings = strings;
    this.values = values;
    this.type = type;
  }

  get isTemplateResult() { return true; }
}

export function isTemplateResult(value) {
  return value instanceof TemplateResult;
}

export function html(strings, ...values) {
  return new TemplateResult(strings, values, 'html');
}

export function raw(strings, ...values) {
  // `raw` keeps its historical string contract. It is not a TemplateResult.
  return rawStrings(strings, values);
}
