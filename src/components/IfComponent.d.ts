import { ComponentInstance, ComponentConstructor } from './Component.js';

/**
 * If component for conditional rendering
 *
 * @example
 * ```html
 * <veda-if condition="{this.isVisible}">
 *   <div>Content shown when condition is true</div>
 * </veda-if>
 * ```
 */
export interface IfComponentInstance extends ComponentInstance {
  /**
   * Expression to evaluate as boolean condition
   * @example "{this.isVisible}" or "{this.model.items.0}"
   */
  condition?: string;
}

export interface IfComponentConstructor extends ComponentConstructor {
  new (): HTMLElement & IfComponentInstance;
  tag: 'veda-if';
}

/**
 * Create an If component class
 * @param Class - Base class to extend (default: HTMLElement)
 */
export default function IfComponent(
  Class?: typeof HTMLElement
): IfComponentConstructor;

export const If: IfComponentConstructor;

