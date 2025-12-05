/**
 * TypeScript-like definitions for DevTools using JSDoc
 * @file Type definitions for Veda DevTools
 */

/**
 * @typedef {Object} ComponentData
 * @property {number} id - Unique component ID
 * @property {WeakRef<HTMLElement>} componentRef - Weak reference to component element
 * @property {string} tagName - Component tag name (lowercase)
 * @property {string|null} modelId - Associated model ID
 * @property {number|null} parentId - Parent component ID
 * @property {number[]} childIds - Array of child component IDs
 * @property {number} createdAt - Creation timestamp
 * @property {number} renderCount - Number of times component rendered
 * @property {number} [totalRenderTime] - Total render time in ms
 * @property {number} [lastRenderTime] - Last render time in ms
 * @property {number} [rendersPerSecond] - Renders per second
 */

/**
 * @typedef {Object} ModelData
 * @property {number} id - Unique model ID
 * @property {string} modelId - Model identifier (e.g., "user:123")
 * @property {string} type - Model type
 * @property {WeakRef<Object>} modelRef - Weak reference to model object
 * @property {boolean} isLoaded - Whether model is loaded
 * @property {Object} properties - Model properties
 * @property {number} updateCount - Number of updates
 * @property {number} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} EffectData
 * @property {number} id - Unique effect ID
 * @property {WeakRef<Function>} effectRef - Weak reference to effect function
 * @property {string} name - Effect name (computed, getter, or function name)
 * @property {number} triggerCount - Number of times effect triggered
 * @property {number} lastTriggered - Last trigger timestamp
 * @property {number} createdAt - Creation timestamp
 * @property {string|null} componentTag - Associated component tag
 * @property {number|null} componentId - Associated component ID
 * @property {Dependency[]} dependencies - Array of tracked dependencies
 * @property {boolean} isComputed - Whether effect is computed property
 * @property {boolean} isLazy - Whether effect is lazy
 */

/**
 * @typedef {Object} Dependency
 * @property {string|null} targetId - Target model/component ID
 * @property {string} property - Property name being tracked
 * @property {string} [targetType] - Type of target (model, component, etc)
 */

/**
 * @typedef {Object} TimelineEvent
 * @property {number} id - Unique event ID
 * @property {string} event - Event type
 * @property {Object} data - Event data
 * @property {number} timestamp - Event timestamp
 */

/**
 * @typedef {Object} Subscription
 * @property {number} id - Subscription ID
 * @property {string} modelId - Subscribed model ID
 * @property {string} status - Subscription status
 * @property {number} createdAt - Creation timestamp
 * @property {number} [lastUpdate] - Last update timestamp
 */

/**
 * @typedef {Object} Snapshot
 * @property {ComponentData[]} components - All tracked components
 * @property {ModelData[]} models - All tracked models
 * @property {EffectData[]} effects - All tracked effects
 * @property {TimelineEvent[]} timeline - Recent timeline events
 * @property {Object} performance - Performance statistics
 * @property {Object} subscriptions - Subscription statistics
 */

/**
 * @typedef {Object} PerformanceStats
 * @property {number} totalComponents - Total number of components
 * @property {number} totalRenders - Total render count
 * @property {number} totalRenderTime - Total render time in ms
 * @property {number} averageRenderTime - Average render time per component
 * @property {ComponentData[]} hotComponents - Components with high render frequency
 */

/**
 * @typedef {Object} MessageContext
 * @property {number} [tabId] - Chrome tab ID
 * @property {chrome.runtime.Port} [port] - Chrome runtime port
 */

export {};

