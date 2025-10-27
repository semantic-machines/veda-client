# Effect System - Race Condition Prevention

## Problem: Synchronous Effects

**Before (race condition possible):**

```javascript
const state = reactive({ count: 0 });

effect(() => {
  console.log('Effect 1:', state.count);
  if (state.count === 1) {
    state.count = 2; // Changes state INSIDE effect!
  }
});

state.count = 1; // Triggers effect IMMEDIATELY → infinite loop risk!
```

**Problems:**
1. **Synchronous execution** - effects run immediately when state changes
2. **Race conditions** - effect can modify state → triggers itself again
3. **Multiple DOM updates** - each state change = immediate DOM update
4. **Wrong order** - effects run in unpredictable order

---

## Solution: Async Effect Queue with Batching

**After (safe):**

```javascript
const state = reactive({ count: 0 });

effect(() => {
  console.log('Effect:', state.count);
});

// Multiple changes
state.count = 1;  // → Queued
state.count = 2;  // → Queued (replaces previous)
state.count = 3;  // → Queued (replaces previous)

// Microtask flush
queueMicrotask(() => {
  // Effect runs ONCE with final value: 3
});
```

**Benefits:**
1. ✅ **Batching** - multiple changes = one effect run
2. ✅ **No race conditions** - effects can't trigger themselves
3. ✅ **Predictable order** - computed effects run first, then regular effects
4. ✅ **Better performance** - minimal DOM updates

---

## How It Works

### 1. Effect Queue

```javascript
// Internal queue
const effectQueue = new Set();
let isFlushing = false;
let isFlushPending = false;

function queueEffect(effect) {
  effectQueue.add(effect);
  if (!isFlushPending && !isFlushing) {
    isFlushPending = true;
    queueMicrotask(flushEffects);
  }
}
```

### 2. Batched Flush

```javascript
function flushEffects() {
  if (isFlushing) return; // Prevent re-entry

  isFlushing = true;
  isFlushPending = false;

  try {
    // Sort effects (computed first)
    const sorted = Array.from(effectQueue).sort((a, b) => {
      if (a.options?.computed && !b.options?.computed) return -1;
      if (!a.options?.computed && b.options?.computed) return 1;
      return 0;
    });

    effectQueue.clear();

    // Run all queued effects
    for (const effect of sorted) {
      effect();
    }
  } finally {
    isFlushing = false;

    // If more effects were queued during flush, flush again
    if (effectQueue.size > 0) {
      queueFlush();
    }
  }
}
```

### 3. Trigger

```javascript
export function trigger(target, key, triggerAll = false) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const effectsToQueue = new Set();

  // Collect effects
  if (triggerAll) {
    depsMap.forEach(dep => {
      dep.forEach(effect => {
        if (effect !== activeEffect) { // Skip currently running effect
          effectsToQueue.add(effect);
        }
      });
    });
  } else {
    const dep = depsMap.get(key);
    if (dep) {
      dep.forEach(effect => {
        if (effect !== activeEffect) {
          effectsToQueue.add(effect);
        }
      });
    }
  }

  // Queue all effects for batched execution
  effectsToQueue.forEach(effect => queueEffect(effect));
}
```

---

## Testing with Async Effects

Since effects are now asynchronous, tests must use `await flushEffects()`:

```javascript
import { reactive, effect, flushEffects } from 'veda-client';

test('Reactive updates', async () => {
  const state = reactive({ count: 0 });
  let result = 0;

  effect(() => {
    result = state.count * 2;
  });

  await flushEffects(); // Wait for initial effect
  assert(result === 0);

  state.count = 5;
  await flushEffects(); // Wait for effect to run
  assert(result === 10);
});
```

---

## Example: Preventing Infinite Loop

**❌ Would cause infinite loop (if synchronous):**

```javascript
const state = reactive({ count: 0 });

effect(() => {
  if (state.count < 10) {
    state.count++; // Modifies state inside effect!
  }
});
```

**✅ Safe with async queue:**

```javascript
const state = reactive({ count: 0 });

effect(() => {
  console.log('Effect run, count =', state.count);
  if (state.count < 10) {
    state.count++; // Queued, won't run immediately
  }
});

await flushEffects(); // Effect runs once, count becomes 1
await flushEffects(); // Effect runs once, count becomes 2
// ... continues until count >= 10
```

---

## Performance Benefits

### Before (Synchronous):

```javascript
// User types in input
state.firstName = 'J';   // → Effect runs → DOM update
state.firstName = 'Jo';  // → Effect runs → DOM update
state.firstName = 'Joh'; // → Effect runs → DOM update
state.firstName = 'John'; // → Effect runs → DOM update

// Total: 4 DOM updates
```

### After (Batched):

```javascript
// User types in input
state.firstName = 'J';   // → Queued
state.firstName = 'Jo';  // → Queued (replaces)
state.firstName = 'Joh'; // → Queued (replaces)
state.firstName = 'John'; // → Queued (replaces)

// Microtask flush
await flushEffects(); // → Effect runs ONCE with final value

// Total: 1 DOM update ✅
```

---

## API

### `flushEffects()`

Manually flush all queued effects. Returns a Promise that resolves when all effects have run.

```javascript
import { flushEffects } from 'veda-client';

// Useful in tests
state.count = 5;
await flushEffects(); // Wait for effects to run

// Or manually control timing
state.count = 10;
requestAnimationFrame(async () => {
  await flushEffects();
  // Effects have run
});
```

---

## Migration Notes

**No changes needed for user code!** Effects are automatically queued and batched.

**Only tests need updating:**

```javascript
// Before
test('my test', () => {
  state.count = 5;
  assert(result === 10); // Immediate
});

// After
test('my test', async () => {
  state.count = 5;
  await flushEffects(); // Wait for effect
  assert(result === 10);
});
```

---

## Conclusion

The async effect queue with batching:
- ✅ Prevents race conditions
- ✅ Improves performance (batching)
- ✅ Guarantees predictable order
- ✅ Protects against infinite loops
- ✅ Works transparently (no user code changes)

This is the same approach used by Vue 3, React 18, and Solid.js.

