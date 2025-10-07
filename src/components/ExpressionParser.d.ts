export interface FunctionWithContext {
  value: Function;
  context: any;
}

export default class ExpressionParser {
  /**
   * Evaluate expression in given context
   */
  static evaluate(expr: string, context: any, preserveContext?: false): any;
  static evaluate(expr: string, context: any, preserveContext: true): FunctionWithContext | any;

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

