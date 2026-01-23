/**
 * Ultra-minimal safe expression parser for template interpolation
 *
 * Safe mode (default) - only dot notation with optional chaining:
 *   model.id
 *   model.rdfs:label.0
 *   model?.items?.0?.id
 *   this.model.v-s:hasApplication.0
 *
 * Unsafe mode (for !{ expr }) - full JavaScript expressions:
 *   model.items.length > 0
 *   model.price * 1.2
 *   model.status === 'active' ? 'Yes' : 'No'
 *
 * No bracket notation, no operators in safe mode - just property access.
 * For complex logic, use getters in your component or !{ } syntax.
 */
export default class ExpressionParser {
  /**
   * Evaluate expression in given context (safe mode - property access only)
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

  /**
   * Evaluate expression in unsafe mode (full JavaScript)
   * Use for !{ expr } syntax - allows operators, method calls, etc.
   * @param {string} expr - JavaScript expression
   * @param {object} context - Context object
   * @returns {*} Evaluated result
   */
  static evaluateUnsafe(expr, context) {
    if (!expr || typeof expr !== 'string') {
      return undefined;
    }

    try {
      // Create function with context as 'this' and properties available via 'with'
      // This allows both 'this.state.x' and direct 'model.x' access
      const fn = new Function(`with(this) { return ${expr}; }`);
      return fn.call(context);
    } catch (error) {
      console.warn(`Unsafe expression error '${expr}':`, error.message);
      return undefined;
    }
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
