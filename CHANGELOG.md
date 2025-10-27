# Changelog

All notable changes to the Veda Client project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Reactive system based on Vue 3 architecture
- `<veda-loop>` component for reactive lists with key-based reconciliation
- `<veda-if>` component for conditional rendering
- Infinite loop detection for async effects (MAX_TRIGGER_COUNT = 100)
- Duplicate key warning in Loop component
- Full TypeScript definitions for Loop and If components
- 3 new tests for infinite loop detection (116 tests total)
- Comprehensive documentation:
  - REACTIVITY.md - core concepts and patterns
  - EFFECT_SYSTEM.md - batched async effects
  - LOOP_IF_COMPONENTS.md - usage guide
  - MIGRATION_REACTIVE.md - migration path
  - TEST_REPORT.md - testing status
  - ROADMAP.md - 5-phase development plan
  - LIMITATIONS.md - known limitations and best practices
  - ADAPTERS_PLAN.md - React/Solid adapter design
  - COMPONENT_EFFECTS_BEST_PRACTICES.md - effect management
  - TYPESCRIPT_USAGE.md - TypeScript examples
  - CRITICAL_ASSESSMENT.md - MVP evaluation
  - CRITICAL_BUGS_FIXED.md - bug fix report
  - CODE_REVIEW_DETAILED.md - comprehensive review

### Changed
- Model now uses `reactive()` internally instead of `Observable` mixin
- Component base class unified with reactive features (opt-in)
- Effect system now uses asynchronous batched execution (microtask queue)
- `flushEffects()` now properly returns `Promise<void>`
- TodoMVC app refactored to use new reactivity (-11 manual `update()` calls)
- Expression syntax changed from `{{}}` to `{}`
- Array mutation methods optimized (sort/reverse only trigger if changed)

### Fixed
- **CRITICAL:** `computed()` function completely broken - added proper dependency tracking
- **CRITICAL:** Circular references caused stack overflow - added WeakMap tracking
- Race condition in `#processTextNode` - insert nodes before removing old one
- Memory leak in `#childrenRendered` - array cleared on each update
- XSS vulnerability in Loop/If components - switched to safe ExpressionParser
- If component manual cleanup redundancy - browser handles it automatically

### Security
- All expression evaluation now uses safe `ExpressionParser`
- No `new Function()` or `eval()` anywhere in framework
- Expression syntax limited to dot notation only (prevents code injection)

### Deprecated
- `Observable` mixin - use `reactive()` directly instead

### Performance
- Optimized array mutation triggers (sort/reverse)
- Batched effect execution prevents race conditions
- Key-based reconciliation for efficient list updates

## [1.x.x] - Previous Version

### Features
- Basic component system
- Model with RDF support
- Backend integration
- Router
- Value handling for RDF literals

---

## Migration Notes

### Upgrading to Reactive System

**Before:**
```javascript
class TodoApp extends Component(HTMLElement) {
  constructor() {
    super();
    this.filter = 'all';
  }
  
  handleFilterChange(newFilter) {
    this.filter = newFilter;
    this.update(); // Manual update!
  }
}
```

**After:**
```javascript
class TodoApp extends Component(HTMLElement) {
  state = reactive({
    filter: 'all'
  });
  
  handleFilterChange(newFilter) {
    this.state.filter = newFilter; // Auto-updates!
  }
}
```

See `MIGRATION_REACTIVE.md` for complete migration guide.

---

## Development Stats

### Phase 1: MVP (October 2025)
- **Duration:** ~5 days
- **Lines added:** +7,255
- **Tests:** 116 (99.1% passing)
- **Documentation:** 13 files
- **Commits:** 10

### Code Review & Fixes
- **Issues found:** 11
- **Critical fixed:** 2
- **High fixed:** 2
- **Medium fixed:** 6
- **Low documented:** 1
- **Time spent:** ~4 hours

---

## Acknowledgments

- Inspired by Vue 3's reactivity system
- Reconciliation algorithm inspired by React
- Fine-grained reactivity concepts from Solid.js

