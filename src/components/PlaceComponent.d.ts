import { ComponentInstance, ComponentConstructor } from './Component.js';

export interface PlaceComponentInstance extends ComponentInstance {
  to?: string;
}

export interface PlaceComponentConstructor extends ComponentConstructor {
  new (): HTMLElement & PlaceComponentInstance;
  tag: 'veda-place';
}

export default function PlaceComponent(
  Class?: typeof HTMLElement
): PlaceComponentConstructor;

export const Place: PlaceComponentConstructor;
