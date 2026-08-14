// Re-export everything from veda-client for examples
export * from '../../../src/index.js';
export { default as Component } from '../../../src/components/Component.js';

// Import all example components
import './examples/reactive-counter.js';
import './examples/reactive-expressions.js';
import './examples/loop-if-demo.js';
import './examples/array-index-reactivity.js';
import './examples/virtual-list-demo.js';
import './examples/virtual-table-demo.js';
import './examples/complex-expressions.js';
import './examples/context-demo.js';
import './examples/slot-place-demo.js';
import './examples/bind-refs-demo.js';