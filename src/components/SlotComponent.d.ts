import { ComponentInstance, ComponentConstructor } from './Component.js';

export interface SlotComponentInstance extends ComponentInstance {
  name?: string;
}

export interface SlotComponentConstructor extends ComponentConstructor {
  new (): HTMLElement & SlotComponentInstance;
  tag: 'veda-slot';
}

export default function SlotComponent(
  Class?: typeof HTMLElement
): SlotComponentConstructor;

export const Slot: SlotComponentConstructor;
