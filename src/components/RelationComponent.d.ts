import { ComponentInstance } from './Component.js';
import Model from '../Model.js';

type RelationComponentClass<T extends HTMLElement = HTMLElement> = new (...args: any[]) => T;

export default function RelationComponent<E extends RelationComponentClass = typeof HTMLElement>(
  Class?: E
): {
  new (): InstanceType<E> & ComponentInstance & RelationComponentInstance;
} & E;

export interface RelationComponentInstance {
  renderValue(value: Model, container: HTMLElement | ShadowRoot, index: number): Promise<void>;
}

