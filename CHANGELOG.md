# Changelog

All notable changes to Veda Client Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-11

### Breaking
- `html` returns a `TemplateResult` object, not a string. Mount it with
  `render(result, container)` or return it from `Component.render()`.
- `TemplateResult.toString()` and the legacy string serializer were removed:
  there is no string form of a template, and `String(result)` no longer
  produces markup.
- Declaratively created components no longer receive a baked `template` string;
  their author content lives in `_compiledTemplate`/`_templateSource`. A custom
  `render()` that reads `this.template` must switch to returning an `html` template literal.
- `Slot` no longer re-parses a host's `template`/`innerHTML` string and no longer
  projects hosts that were assembled outside a template. Author such hosts with
  `html`; everything projected now comes from the host's compiled template.
- Every `innerHTML` write in the engine (the compiler and `unsafeHTML()`) goes
  through the `veda-template` Trusted Types policy; `Slot` no longer writes
  markup at all, so there is no direct sink left.
- Values never become markup: `${}` is a text/attribute/spread value. Tag and
  attribute names require an authored name, a Component class with its own
  `static tag`, or `unsafeStatic()`; everything else throws.
- `${attrs}` takes an object/`Map` (`name`, `?bool`, `.prop`, `@event`).
  Attribute-name interpolation and string snippets are no longer parsed.
- `${}` in HTML comments, `<script>`/`<style>`, nested `<template>`, framework
  config (`key`, `as`, heights) and `ref` is a compile error.
- Static `on*` attributes, `srcdoc`, and `:srcdoc`/`:on*`/`:innerHTML`/
  `:outerHTML` are compile errors; use `{expression}` or `unsafeHTML()`.
- `javascript:`/`vbscript:` URLs are refused for URL attributes, including
  values written with `{expression}`.
- `Component._process()` and its legacy helpers were removed; rendering goes
  through compiled templates, and `post()` no longer receives the fragment.
- Internal helper methods that tracked DOM work by hand (`_getRenderEffectsCount`,
  `_cleanupAllEventListeners`, `_extractRenderEffects`, `_extractEventListeners`,
  `_stopEventListeners`) were removed from `ComponentInstance`; Parts own their
  effects and listeners now. `_getEventListenersCount()` is kept but reports the
  listeners of the template instance the component owns.
- `is` values and dynamic tag names are validated as custom-element names.

### Added
- Marker-based `ChildPart`/`AttributePart`/`PropertyPart`/`EventPart`/
  `RefPart`/`BindPart`/`AttributesPart` with in-place patching.
- `unsafeStatic()`, `unsafeHTML()`, `nothing`, `noChange` and `render()`.
- Randomized markers, a reserved `data-veda-*` namespace, marker collision
  errors, and a `veda-template` Trusted Types policy.
- `src/template/security.js`: attribute/URL policy and forbidden names.
- Template cache per call-site/source and an `ExpressionParser.compile()` cache.
- `Loop`, `If`, `Slot`, `Place`, `Property`, `Relation`, `Value` and `Virtual`
  use compiled templates and Parts; nested `TemplateResult` instances are reused.
- `Virtual` renders its children through the same engine, so `${}` values,
  refs, listeners and the URL/attribute policy now apply to virtualized lists.
- `TEMPLATE_ENGINE.md` documents the engine and its limitations.

### Changed
- Runtime diagnostics counters were removed from the render hot paths.
  `getTemplateCacheStats()` now reports only `{engine, stringCacheSize}` and
  `resetTemplateStats()` is a no-op; both are deprecated.
- `update()` patches unchanged templates, keeping DOM, child components, refs
  and focus; `Place`/`Slot` patch moved/projected nodes in place.
- Parent `${}` values reach a child only for parent-authored templates.
- `EventPart` resolves the handler on every event.
- `Value`/`Property`/`Relation` replace only changed values.
- `Slot` projects a pruned clone of the host's compiled parent content with
  its values (live and URL-guarded). Hosts assembled outside a template
  (`innerHTML`) have no compiled source and are not projected; author them
  with `html` (see `SECURITY.md`).
- `raw` as a `${}` value is text; `html('...')` with values throws.
- `items`/`condition` upgrade native elements only; diagnostics version is
  `templateresult-parts-v3`.

### Fixed
- Data cannot reach template source (entity braces, forged markers,
  `items`/`condition` injection).
- Spread and dynamic tag values cannot inject `on*`, `srcdoc`, framework
  attributes, script URLs or markup.
- `${}` in slotted content stays text/attribute and is URL-guarded.
- Parent updates no longer overwrite a child's own `${}` values; `EventPart`
  keeps the current handler.
- `${}` parts no longer shift siblings; nested template nodes are cleared.
- DOM nodes are not wrapped in reactive proxies (`Node.contains` works).
- `Place` restores author refs; `Property` invalidates on `lang`.
- Caches are LRU and `clearTemplateCache()` clears per-call-site templates.

## [3.0.0] - 2025-11

### Added
- Fine-grained reactivity system with automatic dependency tracking
- Batched async effect execution via microtask queue
- Component reactivity with reactive expressions in templates
- Loop component with key-based reconciliation
- If component for conditional rendering
- Property and Relation components for RDF data binding
- watch() API for side effects on reactive state changes
- computed() for derived values
- Infinite loop detection (max 100 triggers)
- Full TypeScript type definitions
- Comprehensive documentation (API, Reactivity, Security, Troubleshooting)

### Changed
- **BREAKING:** Effects now run asynchronously (use flushEffects() in tests)
- **BREAKING:** Loop/If components use new syntax with component references
- **BREAKING:** Expression parser is stricter (only property access, no operators)
- Component `this.state` is now automatically reactive (no need for manual reactive() call)
- Component lifecycle methods are now async-friendly

### Deprecated
- None

### Removed
- Manual model subscription in components (replaced by automatic reactivity)

### Fixed
- Race conditions in concurrent effect flushes
- Circular reference handling in reactive proxies
- Prototype pollution prevention

### Security
- Unified `{expr}` syntax with auto-detection: simple property access is CSP-compatible (no eval), complex expressions (operators, ternaries, function calls) use safe evaluation with result sanitization
- safe() function removes `{expr}` to prevent template injection
- Double protection against XSS: result sanitization + processed node marking

## [1.x] - Previous versions

Legacy version without reactive system. See git history for details.

