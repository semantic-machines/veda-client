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

