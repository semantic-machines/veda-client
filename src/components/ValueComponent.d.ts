import { ComponentInstance } from './Component.js';

type ValueComponentClass<T extends HTMLElement = HTMLElement> = new (...args: any[]) => T;

export default function ValueComponent<E extends ValueComponentClass = typeof HTMLElement>(
  Class?: E
): {
  new (): InstanceType<E> & ComponentInstance & ValueComponentInstance;
} & E;

export interface ValueComponentInstance {
  prop: string;

  render(): void;
  /**
   * May return a cleanup function (or an object with `cleanup`/`instance`) so
   * the value node can be released before it is replaced.
   */
  renderValue(
    value: any,
    container: HTMLElement | ShadowRoot,
    index: number,
  ): RenderValueResult;
}

/** Result accepted from `ValueComponent.renderValue()` overrides. */
export type RenderValueResult =
  | void
  | null
  | (() => void)
  | {
    cleanup?: (() => void) | null;
    instance?: unknown;
  };

