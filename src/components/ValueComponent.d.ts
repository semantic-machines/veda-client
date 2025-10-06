import { ComponentInstance } from './Component.js';

type ValueComponentClass<T extends HTMLElement = HTMLElement> = new (...args: any[]) => T;

export default function ValueComponent<E extends ValueComponentClass = typeof HTMLElement>(
  Class?: E
): {
  new (): InstanceType<E> & ComponentInstance & ValueComponentInstance;
} & E;

export interface ValueComponentInstance {
  prop: string;
  handler: (...args: any[]) => void;
  
  render(): void;
  renderValue(value: any, container: HTMLElement | ShadowRoot): void;
}

