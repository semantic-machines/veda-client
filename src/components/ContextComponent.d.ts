import { ComponentInstance, ComponentConstructor } from './Component.js';

export interface ContextComponentInstance extends ComponentInstance {}

export interface ContextComponentConstructor extends ComponentConstructor {
  new (): HTMLElement & ContextComponentInstance;
  tag: 'veda-context';
}

export default function ContextComponent(
  Class?: typeof HTMLElement
): ContextComponentConstructor;

export const Context: ContextComponentConstructor;
