import Model from '../Model.js';

export function html(strings: TemplateStringsArray, ...values: any[]): string;
export function raw(strings: TemplateStringsArray, ...values: any[]): string;
export function safe(value: any): string | string[];

export interface ComponentState<M extends Model = Model> {
  model?: M;
  [key: string]: any;
}

export interface ComponentInstance<M extends Model = Model> {
  state: ComponentState<M>; // Reactive state object with typed model
  model?: M; // Direct model access (alternative to state.model)
  template?: string;
  rendered: Promise<void>;

  connectedCallback(): Promise<void>;
  disconnectedCallback(): Promise<void>;
  renderedCallback(): void;

  added(): void | Promise<void>;
  pre(): void | Promise<void>;
  render(): string | Promise<string> | undefined;
  post(fragment?: DocumentFragment): void | Promise<void>;
  removed(): void | Promise<void>;

  update(): Promise<void>;
  populate(): Promise<void>;

  // Reactive methods
  effect(fn: () => void): () => void;
  watch<T>(getter: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: { immediate?: boolean }): () => void;

  // Internal helper method
  _findParentComponent(): HTMLElement | null;
}

export interface ComponentConstructor {
  new (): HTMLElement & ComponentInstance;
  tag: string;
  toString(): string;
}

export default function Component(
  ElementClass?: any,
  ModelClass?: any
): ComponentConstructor;

// Re-export reactive utilities
export function reactive<T extends object>(target: T): T;
export function effect(fn: () => void, options?: { lazy?: boolean; scheduler?: (effect: () => void) => void; computed?: boolean }): () => void;

