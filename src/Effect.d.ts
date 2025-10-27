/**
 * Creates an effect that automatically tracks dependencies and re-runs when they change
 */
export function effect(fn: () => void | any, options?: {
  lazy?: boolean;
  scheduler?: (effect: () => void) => void;
  computed?: boolean;
}): () => void;

/**
 * Track property access for the current active effect
 */
export function track(target: object, key: string | symbol): void;

/**
 * Trigger all effects that depend on a property
 */
export function trigger(target: object, key: string | symbol, triggerAll?: boolean): void;

/**
 * Flush all queued effects (for testing)
 */
export function flushEffects(): Promise<void>;

/**
 * Pause tracking temporarily
 */
export function pauseTracking(): void;

/**
 * Resume tracking
 */
export function resumeTracking(): void;

/**
 * Stop tracking for a function call
 */
export function untrack<T>(fn: () => T): T;

