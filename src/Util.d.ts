export function genUri(): string;
export function guid(): string;

export function asyncDecorator<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  pre?: (...args: Parameters<T>) => void | Promise<void>,
  post?: (...args: Parameters<T>) => void | Promise<void>,
  err?: (error: Error) => void | Promise<void>
): T;

export function syncDecorator<T extends (...args: any[]) => any>(
  fn: T,
  pre?: (...args: Parameters<T>) => void,
  post?: (...args: Parameters<T>) => void,
  err?: (error: Error) => void
): T;

export function decorator<T extends (...args: any[]) => any>(
  fn: T,
  pre?: (...args: Parameters<T>) => void | Promise<void>,
  post?: (...args: Parameters<T>) => void | Promise<void>,
  err?: (error: Error) => void | Promise<void>
): T;

export function timeout(ms: number): Promise<void>;

export function diff<T extends Record<string, any>>(first: T, second: T): string[];
export function eq<T>(first: T, second: T): boolean;

export function dashToCamel(str: string): string;

