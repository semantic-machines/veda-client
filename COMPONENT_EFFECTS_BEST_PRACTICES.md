# Component Effects - Best Practices

## 🎯 TL;DR

**✅ DO:** Use `this.effect()` and `this.watch()`  
**❌ DON'T:** Use `import { effect }` directly

---

## 📚 Background

The `Component` base class automatically manages effect cleanup in `disconnectedCallback()`. But this only works if you use the component methods.

---

## ✅ Correct Usage

### Using `this.effect()`

```javascript
import Component from './components/Component.js';

class MyComponent extends Component(HTMLElement) {
  static tag = 'my-component';
  
  constructor() {
    super();
    this.state = reactive({ count: 0 });
  }

  async connectedCallback() {
    await super.connectedCallback();
    
    // ✅ GOOD: Auto-cleanup on disconnect
    this.effect(() => {
      console.log('Count:', this.state.count);
      // Effect will be automatically cleaned up when component disconnects
    });
  }
}
```

### Using `this.watch()`

```javascript
class MyComponent extends Component(HTMLElement) {
  async connectedCallback() {
    await super.connectedCallback();
    
    // ✅ GOOD: Auto-cleanup on disconnect
    this.watch(
      () => this.state.count,
      (newValue, oldValue) => {
        console.log(`Count changed from ${oldValue} to ${newValue}`);
      },
      { immediate: true }
    );
  }
}
```

---

## ❌ Incorrect Usage

### Don't import effect directly

```javascript
import Component from './components/Component.js';
import { effect } from './Effect.js'; // ❌ BAD

class MyComponent extends Component(HTMLElement) {
  async connectedCallback() {
    await super.connectedCallback();
    
    // ❌ BAD: Will NOT be auto-cleaned up!
    effect(() => {
      console.log('Count:', this.state.count);
      // This effect keeps running even after component disconnects
      // → Memory leak!
    });
  }
}
```

**Problem:**
- Effect not registered with component
- Runs forever, even after component removed
- Memory leak!

---

## 🔧 Manual Cleanup (Advanced)

If you MUST use direct `effect` import (rare case), clean it up manually:

```javascript
import { effect } from './Effect.js';

class MyComponent extends Component(HTMLElement) {
  #myEffect = null;
  
  async connectedCallback() {
    await super.connectedCallback();
    
    // Create effect and save cleanup function
    this.#myEffect = effect(() => {
      console.log('Count:', this.state.count);
    });
  }
  
  disconnectedCallback() {
    // ✅ Manual cleanup
    if (this.#myEffect) {
      this.#myEffect(); // Call cleanup function
      this.#myEffect = null;
    }
    
    super.disconnectedCallback?.();
  }
}
```

**When to use:**
- Very rare cases where you need fine-grained control
- 99% of the time, use `this.effect()` instead

---

## 🏗️ How It Works Internally

### Component Base Class

```javascript
export default function Component(Class = HTMLElement) {
  return class ComponentClass extends Class {
    #effects = []; // Stores cleanup functions
    
    // Helper method: auto-registers cleanup
    effect(fn) {
      const cleanup = effect(fn); // Call global effect
      this.#effects.push(cleanup); // ✅ Register for auto-cleanup
      return cleanup;
    }
    
    // Called by browser when component removed
    disconnectedCallback() {
      this.#cleanupEffects(); // ✅ Auto-cleanup all effects
      // ... other cleanup
    }
    
    // Internal: cleanup all registered effects
    #cleanupEffects() {
      this.#effects.forEach(cleanup => cleanup());
      this.#effects = [];
    }
  };
}
```

### Browser Lifecycle

```
1. Component added to DOM
   → connectedCallback() called
   → this.effect() creates and registers effects

2. Component removed from DOM
   → disconnectedCallback() called by browser
   → #cleanupEffects() called automatically
   → All effects stopped
   → No memory leaks!
```

---

## 🐛 Common Mistakes

### Mistake 1: Direct effect import

```javascript
import { effect } from './Effect.js'; // ❌

class MyComponent extends Component(HTMLElement) {
  connectedCallback() {
    effect(() => { /* leak! */ });
  }
}
```

**Fix:** Use `this.effect()`

### Mistake 2: Forgetting super.disconnectedCallback()

```javascript
class MyComponent extends Component(HTMLElement) {
  disconnectedCallback() {
    // Custom cleanup
    this.myTimer && clearTimeout(this.myTimer);
    
    // ❌ FORGOT: super.disconnectedCallback();
    // Effects won't be cleaned up!
  }
}
```

**Fix:** Always call super!

```javascript
disconnectedCallback() {
  this.myTimer && clearTimeout(this.myTimer);
  super.disconnectedCallback?.(); // ✅
}
```

### Mistake 3: Creating effects in constructor

```javascript
class MyComponent extends Component(HTMLElement) {
  constructor() {
    super();
    
    // ❌ BAD: State might not exist yet
    this.effect(() => {
      console.log(this.state.count); // May be undefined!
    });
  }
}
```

**Fix:** Create effects in `connectedCallback`:

```javascript
async connectedCallback() {
  await super.connectedCallback();
  
  // ✅ GOOD: After component fully initialized
  this.effect(() => {
    console.log(this.state.count);
  });
}
```

---

## 📊 Memory Leak Detection

### How to check for leaks:

```javascript
class MyComponent extends Component(HTMLElement) {
  async connectedCallback() {
    await super.connectedCallback();
    
    this.effect(() => {
      console.log('Effect running for', this.constructor.name);
    });
  }
}

// Test:
const container = document.body;

// Add component
const comp = document.createElement('my-component');
container.appendChild(comp);
// Console: "Effect running for MyComponent"

// Remove component
comp.remove();

// Change state (shouldn't trigger effect anymore)
comp.state.count++;

// ✅ No console log = effect properly cleaned up
// ❌ Console log = memory leak!
```

---

## ✅ Checklist

Before committing component code:

- [ ] Use `this.effect()` not `import { effect }`
- [ ] Use `this.watch()` not manual effect + comparison
- [ ] If override `disconnectedCallback`, call `super.disconnectedCallback()`
- [ ] Test: remove component, change state, verify no effects run
- [ ] No timers/intervals without cleanup
- [ ] No event listeners on `window`/`document` without cleanup

---

## 🎓 Summary

| Pattern | Auto-cleanup? | Use case |
|---------|---------------|----------|
| `this.effect()` | ✅ Yes | 99% of cases |
| `this.watch()` | ✅ Yes | Watching specific values |
| `import { effect }` + manual cleanup | ⚠️ No | Advanced/rare cases |
| `import { effect }` + no cleanup | ❌ Never | Memory leak! |

**Golden rule:** If you're inside a component, use `this.effect()` and `this.watch()`.

---

**Last updated:** Phase 1.1  
**Status:** Production-ready pattern

