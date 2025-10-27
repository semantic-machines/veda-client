import Model from '../Model.js';

export function html(strings: TemplateStringsArray, ...values: any[]): string;
export function raw(strings: TemplateStringsArray, ...values: any[]): string;
export function safe(value: any): string | string[];

export interface ComponentInstance<M extends Model = Model> {
  model?: M;
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
  reactive<T extends object>(obj: T): T;
  effect(fn: () => void): () => void;
  watch<T>(getter: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options?: { immediate?: boolean }): () => void;
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

