export { default as Backend } from './Backend.js';
export { default as BackendError } from './BackendError.js';
export { default as Subscription } from './Subscription.js';
export { default as Emitter } from './Emitter.js';
export { default as Model } from './Model.js';
export { default as Component, html, safe, raw, reactive, effect } from './components/Component.js';
export { computed } from './Reactive.js';
export { flushEffects, trigger, untrack, pauseTracking, resumeTracking } from './Effect.js';
export { default as Router } from './Router.js';

// Built-in components for declarative rendering
export { Loop } from './components/LoopComponent.js';
export { If } from './components/IfComponent.js';

// Note: PropertyComponent, RelationComponent, and ValueComponent are NOT exported.
// They are internal components used via declarative syntax:
//   <span property="v-s:title"></span>  ✅ Use declarative attribute
//   import PropertyComponent from '...' ❌ Not available from index.js
// See API.md "Advanced Components" section for details.

// Note: Value and WeakCache are internal APIs and not exported from index.
// If you need them, import directly from source:
//   import Value from 'veda-client/src/Value.js';
//   import WeakCache from 'veda-client/src/WeakCache.js';

export * from './Util.js';

// Re-export types
export type { IndividualData, AuthResult, QueryResult, QueryParams, UploadFileParams } from './Backend.js';
export type { ValueData, ValueType, PrimitiveValue } from './Value.js';
export type { EmitterInstance } from './Emitter.js';
export type { ModelValue } from './Model.js';
export type { ComponentInstance } from './components/Component.js';
export type { LoopComponentInstance } from './components/LoopComponent.js';
export type { IfComponentInstance } from './components/IfComponent.js';
export type { Reactive, ReactiveOptions } from './Reactive.js';


