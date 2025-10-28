/**
 * Ultra-minimal safe expression parser for template interpolation
 *
 * Supports only dot notation with optional chaining:
 *   model.id
 *   model.rdfs:label.0
 *   model?.items?.0?.id
 *   this.model.v-s:hasApplication.0
 *
 * No bracket notation, no operators - just property access.
 * For complex logic, use getters in your component.
 */
export default class ExpressionParser {
  /**
   * Evaluate expression in given context
   * @param {string} expr - Expression to evaluate (e.g., "model.rdfs:label.0")
   * @param {object} context - Context object (usually component instance)
   * @param {boolean} preserveContext - If true, returns {value, context} for functions
   * @returns {*} Evaluated result or {value, context} if preserveContext is true
   */
  static evaluate(expr, context, preserveContext = false) {
    if (!expr || typeof expr !== 'string') {
      return undefined;
    }

    const normalized = this.#normalizeExpression(expr);

    if (normalized === '') {
      return context;
    }

    const parts = normalized.split(/(\?\.|\.)/).filter(part => part && part !== '.');
    const result = this.#evaluateParts(parts, context);

    if (preserveContext && typeof result.value === 'function' && result.parent) {
      return { value: result.value, context: result.parent };
    }

    return result.value;
  }

  static #normalizeExpression(expr) {
    if (expr === 'this') {
      return '';
    }
    if (expr.startsWith('this.')) {
      return expr.slice(5);
    }
    return expr;
  }

  static #evaluateParts(parts, context) {
    let value = context;
    let parent = null;
    let nextIsOptional = false;

    for (const part of parts) {
      if (part === '?.') {
        nextIsOptional = true;
        continue;
      }

      if (value == null) {
        if (nextIsOptional) {
          return { value: undefined, parent };
        }
        throw new Error(`Cannot read property '${part}' of ${value}`);
      }

      parent = value;
      const numericValue = /^\d+$/.test(part) ? parseInt(part, 10) : part;
      value = value[numericValue];
      nextIsOptional = false;
    }

    return { value, parent };
  }
}
