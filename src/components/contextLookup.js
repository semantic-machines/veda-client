import {toRaw} from '../Reactive.js';

const MAX_TREE_DEPTH = 20;
const missingKeys = new WeakMap();

const INSPECT_KEYS = new Set([
  'then', 'toJSON', 'toString', 'valueOf', 'constructor', 'inspect', '$$typeof',
]);

export function isContextElement(el) {
  return el?.tagName?.toLowerCase() === 'veda-context';
}

function ancestorElement(el) {
  return el.parentElement || el.getRootNode?.()?.host || null;
}

function warnMissing(owner, key) {
  if (typeof key !== 'string' || key.startsWith('_') || INSPECT_KEYS.has(key)) return;
  let keys = missingKeys.get(owner);
  if (!keys) {
    keys = new Set();
    missingKeys.set(owner, keys);
  }
  if (keys.has(key)) return;
  keys.add(key);
  console.warn(`Context key '${key}' not found in component tree`);
}

export function lookupContextValue(owner, key) {
  let el = owner;
  for (let i = 0; el && i < MAX_TREE_DEPTH; i++, el = ancestorElement(el)) {
    if (!isContextElement(el) || !el.state) continue;
    const raw = toRaw(el.state);
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    return el.state[key];
  }
  warnMissing(owner, key);
  return undefined;
}

export function createContextProxy(owner) {
  return new Proxy(Object.create(null), {
    get(_target, key) {
      if (key === '__isContext') return true;
      if (typeof key === 'symbol') return undefined;
      return lookupContextValue(owner, key);
    },
  });
}
