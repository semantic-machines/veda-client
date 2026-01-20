import { ComponentConstructor } from './Component.js';

/**
 * Virtual scrolling wrapper component for efficient rendering of large lists.
 * 
 * @example
 * ```html
 * <veda-virtual items="{this.state.items}" height="400" item-height="40">
 *   <veda-loop items="{this.visibleItems}" key="id" as="item">
 *     <div class="row">{item.name}</div>
 *   </veda-loop>
 * </veda-virtual>
 * ```
 */
export default function VirtualComponent<T extends typeof HTMLElement>(
  Class?: T
): ComponentConstructor<T> & {
  new (): InstanceType<T> & VirtualComponentInstance;
};

export interface VirtualComponentInstance {
  /** Height of each item in pixels */
  readonly itemHeight: number;
  
  /** Height of the viewport in pixels */
  readonly viewportHeight: number;
  
  /** Number of items to render outside visible area */
  readonly overscan: number;
  
  /** Index of first visible item */
  readonly virtualStart: number;
  
  /** Index of last visible item */
  readonly virtualEnd: number;
  
  /** Slice of items currently visible (available to children) */
  readonly visibleItems: unknown[];
  
  /** Total number of items */
  readonly virtualTotal: number;
  
  /** Total height of all items in pixels (clamped to browser max) */
  readonly totalHeight: number;
  
  /** Y offset for transform positioning */
  readonly offsetY: number;
  
  /** Maximum number of items that can be scrolled due to browser height limit */
  readonly maxVisibleItems: number;
  
  /** True if list exceeds browser height limit */
  readonly isHeightLimited: boolean;
  
  /** Scroll event handler */
  handleScroll(e: Event): void;
}

export interface VirtualComponentAttributes {
  /** Expression returning array of items */
  items: string;
  
  /** Viewport height in pixels or 'auto' */
  height?: string | number;
  
  /** Height of each item in pixels */
  'item-height'?: string | number;
  
  /** Number of items to render outside visible area (default: 3) */
  overscan?: string | number;
}

/** Pre-defined Virtual component class */
export const Virtual: ReturnType<typeof VirtualComponent>;
