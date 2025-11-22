import { ComponentInstance, ComponentConstructor } from './Component.js';

/**
 * Loop component for rendering reactive lists with reconciliation
 *
 * @example
 * ```html
 * <veda-loop items="{this.todos}" as="todo" key="id">
 *   <todo-item :todo="{todo}"></todo-item>
 * </veda-loop>
 * ```
 */
export interface LoopComponentInstance extends ComponentInstance {
  /**
   * Expression to get array of items
   * @example "{this.todos}" or "{this.model.v-s:hasTodo}"
   */
  items?: string;

  /**
   * Variable name for item in template (default: 'item')
   * @example "todo", "user", "product"
   * @default "item"
   */
  as?: string;

  /**
   * Property name to use as unique key for reconciliation
   * Also accepts 'item-key' for backward compatibility
   * @default "id"
   */
  key?: string;
  'item-key'?: string;
}

export interface LoopComponentConstructor extends ComponentConstructor {
  new (): HTMLElement & LoopComponentInstance;
  tag: 'veda-loop';
}

/**
 * Create a Loop component class
 * @param Class - Base class to extend (default: HTMLElement)
 */
export default function LoopComponent(
  Class?: typeof HTMLElement
): LoopComponentConstructor;

export const Loop: LoopComponentConstructor;

