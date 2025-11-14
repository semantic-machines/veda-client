# Test Suite Structure

## 📁 Directory Structure

```
test/
├── *.test.js           # Unit tests (fast, isolated, with mocks)
├── integration/        # Integration tests (slow, require server)
├── mocks/             # Mock implementations
│   ├── Backend.mock.js
│   └── WebSocket.mock.js
└── helpers.js         # Test utilities
```

## 🚀 Running Tests

```bash
# Run all tests (unit + integration)
pnpm test

# Run only unit tests (fast, ~2-5s)
pnpm test:unit

# Run only integration tests (slow, requires server, ~30s)
pnpm test:integration

# Run with coverage
pnpm c8           # all tests
pnpm c8:unit      # unit tests only
```

## 🎯 Test Categories

### Unit Tests
- **Location**: `test/*.test.js`
- **Speed**: Fast (2-5 seconds)
- **Dependencies**: None (uses mocks)
- **Purpose**: Test individual components in isolation
- **Examples**:
  - `Model.test.js` - Model with mocks
  - `Subscription.test.js` - Subscription with MockWebSocket
  - `Component.raw.test.js` - Component helpers

### Integration Tests
- **Location**: `test/integration/*.test.js`
- **Speed**: Slow (30+ seconds)
- **Dependencies**: Requires running veda server
- **Purpose**: Test real interactions with server
- **Examples**:
  - `Model.integration.test.js` - Model with real Backend
  - `Subscription.integration.test.js` - Subscription with real WebSocket
  - `Backend.test.js` - Backend API tests
  - `Integration.test.js` - End-to-end scenarios

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
import Backend from '../src/Backend.js';

test('My integration test', async () => {
  await Backend.authenticate('user', 'hash');

  // Test with real server...
});
```

## 📊 Coverage

Current coverage: **99.76%**

- Statements: 99.76%
- Branches: 95.89%
- Functions: 99.01%
- Lines: 99.76%

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
- Test names: descriptive, indicate what is being tested

## ⚡ Performance

| Type | Tests | Time | Server | Coverage |
|------|-------|------|--------|----------|
| Unit | 327  | ~3s  | ❌     | ~88%     |
| Integration | 93 | ~26s | ✅ Required | +12% (backend paths) |
| All  | 420  | ~29s | ✅ Required | ~99.76% |

**Recommendation**: Run `pnpm test:unit` during development, `pnpm test` before commit.

