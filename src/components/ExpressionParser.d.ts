export interface FunctionWithContext {
  value: Function;
  context: any;
}

export default class ExpressionParser {
  /**
   * Evaluate simple property path expression (no eval, CSP-compatible).
   * Only supports dot notation with optional chaining.
   */
  static evaluate(expr: string, context: any, preserveContext?: false): any;
  static evaluate(expr: string, context: any, preserveContext: true): FunctionWithContext | any;

  /**
   * Primary expression evaluator with auto-detection.
   * Simple property paths use safe traversal (no eval, CSP-compatible).
   * Complex expressions (operators, method calls, etc.) use new Function().
   */
  static evaluateAuto(expr: string, context: any, preserveContext?: false): any;
  static evaluateAuto(expr: string, context: any, preserveContext: true): FunctionWithContext | any;

  /**
   * Check if expression is a simple property path (safe for property traversal).
   * Returns false for expressions with operators, method calls, brackets, etc.
   */
  static isSafe(expr: string): boolean;
}

