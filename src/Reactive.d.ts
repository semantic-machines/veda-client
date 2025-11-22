/**
 * Options for reactive proxy
 */
export interface ReactiveOptions {
  onSet?: (key: string | symbol, value: any, oldValue: any) => void;
  onDelete?: (key: string | symbol) => void;
}

/**
 * Reactive proxy type - object wrapped with reactive()
 */
export type Reactive<T> = T;

/**
 * Creates a reactive proxy that tracks property access and triggers updates
 */
export function reactive<T extends object>(target: T, options?: ReactiveOptions): T;

/**
 * Creates a computed property that automatically tracks dependencies
 */
export function computed<T>(getter: () => T): {
  readonly value: T;
};

/**
 * Creates an effect that automatically tracks dependencies and re-runs when they change
 */
export function effect(fn: () => void, options?: {
  lazy?: boolean;
  scheduler?: (effect: () => void) => void;
  computed?: boolean;
}): () => void;

