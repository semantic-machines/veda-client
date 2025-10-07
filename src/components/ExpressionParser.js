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

    // Remove 'this.' prefix if present
    const normalized = expr.startsWith('this.') ? expr.slice(5) : expr === 'this' ? '' : expr;

    // Return context itself for 'this'
    if (normalized === '') {
      return context;
    }

    // Split by . and ?. to get tokens
    const parts = normalized.split(/(\?\.|\.)/).filter(part => part && part !== '.');

    let value = context;
    let parent = null;
    let nextIsOptional = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // Check for optional chaining marker
      if (part === '?.') {
        nextIsOptional = true;
        continue;
      }

      // Check if value is null/undefined
      if (value == null) {
        if (nextIsOptional) {
          return undefined;
        }
        throw new Error(`Cannot read property '${part}' of ${value}`);
      }

      parent = value;

      // Parse numeric index or property name
      const numericValue = /^\d+$/.test(part) ? parseInt(part, 10) : part;
      value = value[numericValue];

      nextIsOptional = false;
    }

    // If value is a function and we need to preserve context
    if (preserveContext && typeof value === 'function' && parent) {
      return { value, context: parent };
    }

    return value;
  }
}
