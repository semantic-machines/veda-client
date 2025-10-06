import { ComponentInstance } from './Component.js';

type PropertyComponentClass<T extends HTMLElement = HTMLElement> = new (...args: any[]) => T;

export default function PropertyComponent<E extends PropertyComponentClass = typeof HTMLElement>(
  Class?: E
): {
  new (): InstanceType<E> & ComponentInstance & PropertyComponentInstance;
} & E;

export interface PropertyComponentInstance {
  renderValue(value: any, container: HTMLElement | ShadowRoot): void;
}

