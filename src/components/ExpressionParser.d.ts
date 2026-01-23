export interface FunctionWithContext {
  value: Function;
  context: any;
}

export default class ExpressionParser {
  /**
   * Evaluate expression in given context (safe mode - property access only)
   */
  static evaluate(expr: string, context: any, preserveContext?: false): any;
  static evaluate(expr: string, context: any, preserveContext: true): FunctionWithContext | any;

  /**
   * Evaluate expression in unsafe mode (full JavaScript)
   * Use for !{ expr } syntax - allows operators, method calls, etc.
   */
  static evaluateUnsafe(expr: string, context: any): any;

  /**
   * Tokenize expression into property chain
   */
  static tokenize(expr: string): Array<{ key: string; optional: boolean }>;

  /**
   * Resolve token chain to get value
   */
  static resolve(tokens: Array<{ key: string; optional: boolean }>, context: any, preserveContext?: boolean): any;

  /**
   * Check if expression is safe (no function calls, no operators)
   */
  static isSafe(expr: string): boolean;
}

