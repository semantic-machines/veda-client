import type {TemplateResult} from './TemplateResult.js';

/**
 * @deprecated Per-host/counter diagnostics were removed in 4.0.
 * Only the engine marker and the string-cache size are reported now.
 */
export interface TemplateCacheStats {
  engine: string;
  stringCacheSize: number;
}

export interface PartDescriptor {
  type: string;
  [key: string]: unknown;
}

export interface ElementGroup {
  id: number;
  component: Record<string, unknown> | null;
  parts: PartDescriptor[];
}

export interface ChildPartDescriptor {
  id: number;
  segment: Record<string, unknown>;
  anchor: 'text' | 'node';
}

export class CompiledTemplate {
  readonly template: HTMLTemplateElement;
  readonly source: string;
  readonly type: 'html' | 'raw';
  readonly meta: Record<string, unknown>;
  readonly elements: readonly ElementGroup[];
  readonly childParts: readonly ChildPartDescriptor[];
  instantiate(context: object, host: object, options?: {
    result?: unknown;
    values?: readonly unknown[];
    nested?: boolean;
  }): unknown;
}

export const TEMPLATE_ENGINE: string;
/** @internal Route a trusted markup string through the `veda-template` policy. */
export function trustedHTML(source: string): string;
export function compileTemplate(input: TemplateResult | CompiledTemplate | string | null | undefined): CompiledTemplate;
export function render(
  result: TemplateResult | CompiledTemplate | string | null | undefined,
  container: Element | DocumentFragment | ShadowRoot,
): unknown;
export function getTemplateCacheStats(): TemplateCacheStats;
export function resetTemplateStats(): void;
export function clearTemplateCache(): void;
