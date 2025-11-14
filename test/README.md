# Test Suite Structure

## 📁 Directory Structure

```
test/
├── *.test.js           # Unit tests (fast, isolated, with mocks)
├── integration/        # Integration tests (slow, require server)
├── benchmarks/         # Performance benchmarks (optional)
├── mocks/             # Mock implementations
│   ├── Backend.mock.js
│   └── WebSocket.mock.js
└── helpers.js         # Test utilities
```

## 🚀 Running Tests

```bash
# Run all tests (unit + integration, without benchmarks)
pnpm test

# Run only unit tests (fast, ~2-3s)
pnpm test:unit

# Run only integration tests (slow, requires server, ~26s)
pnpm test:integration

# Run only performance benchmarks (fast, ~0.7s)
pnpm test:benchmark

# Run with coverage
pnpm c8           # all tests
pnpm c8:unit      # unit tests only
```

## 🎯 Test Categories

### Unit Tests
- **Location**: `test/*.test.js`
- **Speed**: Fast (2-3 seconds)
- **Dependencies**: None (uses mocks)
- **Purpose**: Test individual components in isolation
- **Count**: 362 tests
- **Examples**:
  - `Model.test.js` - Model with mocks
  - `Subscription.test.js` - Subscription with MockWebSocket
  - `Component.test.js` - Component functionality

### Integration Tests
- **Location**: `test/integration/*.test.js`
- **Speed**: Slow (26+ seconds)
- **Dependencies**: Requires running veda server
- **Purpose**: Test real interactions with server
- **Count**: 93 tests
- **Examples**:
  - `Model.integration.test.js` - Model with real Backend
  - `Subscription.integration.test.js` - Subscription with real WebSocket
  - `Backend.test.js` - Backend API tests
  - `Integration.test.js` - End-to-end scenarios

### Performance Benchmarks
- **Location**: `test/benchmarks/*.test.js`
- **Speed**: Fast (0.7 seconds)
- **Dependencies**: None
- **Purpose**: Measure performance and detect regressions
- **Count**: 12 benchmarks
- **Examples**:
  - Reactive object creation
  - Effect execution speed
  - Component rendering performance
  - Memory usage profiling

## 🛠 Writing Tests

### Unit Test Best Practices

```javascript
import { clearModelCache, generateTestId, waitForCondition } from './helpers.js';

test('My unit test', async () => {
  clearModelCache(); // Isolate test

  const id = generateTestId('test:my'); // Unique ID

  // Test code...

  await waitForCondition(
    () => condition === true,
    { timeout: 1000, message: 'Should meet condition' }
  );

  clearModelCache(); // Cleanup
});
```

### Integration Test Example

```javascript
import Backend from '../../src/Backend.js';

test('My integration test', async () => {
  await Backend.authenticate('user', 'hash');

  // Test with real server...
});
```

### Benchmark Test Example

```javascript
test('Benchmark - my operation', () => {
  const start = performance.now();
  
  for (let i = 0; i < 1000; i++) {
    // Operation to benchmark
  }
  
  const elapsed = performance.now() - start;
  console.log(`📊 My operation: ${elapsed.toFixed(2)}ms for 1000 iterations`);
  
  assert(elapsed < 100, 'Should be fast');
});
```

## 📊 Coverage

Current coverage: **100%** 🎉

- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

**All 19 modules have perfect 100% coverage!**

## 🔧 Test Utilities

### helpers.js

- `waitForCondition(fn, options)` - Smart async waiting
- `waitForValue(getter, expected)` - Wait for specific value
- `clearModelCache()` - Isolate Model tests
- `generateTestId(prefix)` - Unique test IDs
- `retry(operation, options)` - Retry with backoff
- `createTestComponent(Class)` - Component test helper
- `captureConsole(fn, method)` - Capture console output
- `createSpy()` - Function call tracking

### Mocks

- `Backend.mock.js` - In-memory backend
- `WebSocket.mock.js` - WebSocket emulation

## 🎨 Test Naming Convention

- Unit tests: `ComponentName.test.js`
- Integration tests: `ComponentName.integration.test.js`
- Benchmarks: `Performance.test.js`
- Test names: descriptive, indicate what is being tested

## ⚡ Performance

| Type | Tests | Time | Server | Coverage |
|------|-------|------|--------|----------|
| Unit | 362  | ~3s  | ❌     | 100%     |
| Integration | 93 | ~26s | ✅ Required | 100% (full coverage) |
| Benchmarks | 12 | ~0.7s | ❌ | N/A (performance) |
| All  | 455  | ~29s | ✅ Required | 100% |

**Recommendation**: 
- During development: `pnpm test:unit` (fast feedback)
- Before commit: `pnpm test` (full validation)
- Weekly/CI: `pnpm test:benchmark` (performance regression check)

