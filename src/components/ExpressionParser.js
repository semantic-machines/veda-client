/**
 * Expression parser for template interpolation with auto-detection.
 *
 * All expressions use unified {expr} syntax. The parser auto-detects complexity:
 *
 * Simple property access (no eval, CSP-compatible):
 *   {model.id}
 *   {model.rdfs:label.0}
 *   {model?.items?.0?.id}
 *   {this.model.v-s:hasApplication.0}
 *
 * Complex expressions (auto-detected, uses new Function):
 *   {model.items.length > 0}
 *   {model.price * 1.2}
 *   {model.status === 'active' ? 'Yes' : 'No'}
 */
export default class ExpressionParser {
  // Pattern for simple property-access-only expressions:
  // optional "this." prefix, then dot-separated property names (with optional chaining).
  // Property names may contain word chars, colons (RDF), and hyphens.
  static #SAFE_EXPR_PATTERN = /^(this\.)?([\w:-]+)(\??\.[\w:-]+)*$/;
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
   * Check if expression is a simple property path that can be handled by safe evaluate().
   * Returns false for expressions with operators, method calls, brackets, etc.
   * @param {string} expr - Expression to check
   * @returns {boolean} True if expression is a safe property path
   */
  static isSafe(expr) {
    if (!expr || typeof expr !== 'string') return true;
    return this.#SAFE_EXPR_PATTERN.test(expr.trim());
  }

  /**
   * Primary expression evaluator with auto-detection.
   * Simple property paths use safe traversal (no eval, CSP-compatible).
   * Complex expressions (operators, method calls, etc.) use new Function().
   * @param {string} expr - Expression to evaluate
   * @param {object} context - Context object
   * @param {boolean} preserveContext - If true, returns {value, context} for functions (simple paths only)
   * @returns {*} Evaluated result
   */
  static evaluateAuto(expr, context, preserveContext = false) {
    if (!expr || typeof expr !== 'string') return undefined;
    const trimmed = expr.trim();
    if (this.isSafe(trimmed)) {
      return this.evaluate(trimmed, context, preserveContext);
    }
    return this.#evaluateComplex(trimmed, context);
  }

  /**
   * Evaluate complex JavaScript expression via new Function().
   * Internal method — used by evaluateAuto() for expressions with operators, calls, etc.
   * @param {string} expr - JavaScript expression
   * @param {object} context - Context object
   * @returns {*} Evaluated result
   */
  static #evaluateComplex(expr, context) {
    if (!expr || typeof expr !== 'string') {
      return undefined;
    }

    try {
      // Create function with context as 'this' and properties available via 'with'
      // This allows both 'this.state.x' and direct 'model.x' access
      const fn = new Function(`with(this) { return ${expr}; }`);
      return fn.call(context);
    } catch (error) {
      console.warn(`Expression error '${expr}':`, error.message);
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
