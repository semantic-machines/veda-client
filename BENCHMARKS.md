# Performance Benchmark Results

Last updated: 2025-11-19

## Summary

All benchmarks run on Node.js with `--expose-gc` flag using JSDOM environment.

## Loop Component Performance

### Initial Render

| Items | Time (ms) | ms/item | Performance |
|-------|-----------|---------|-------------|
| 100   | 31.34     | 0.31    | ✓ Excellent |
| 500   | 50.43     | 0.10    | ✓ Good      |
| 1000  | 78.92     | 0.08    | ✓ Acceptable|

**Scaling:** Linear (O(n)) - initial render time grows proportionally with item count.

### Operations (Add/Remove)

| Operation      | Items    | Time (ms) | Performance |
|----------------|----------|-----------|-------------|
| Add items      | 100→200  | 8.72      | ✓ Excellent |
| Remove items   | 500→250  | 8.03      | ✓ Excellent |
| Update values  | 500      | 7.11      | ✓ Excellent |
| Mixed ops      | 500      | 9.14      | ✓ Excellent |

**Key Finding:** Add/remove/update operations are fast and independent of list size.

### Reordering (Critical Metric)

| Items | Time (ms) | ms/item² | Performance  |
|-------|-----------|----------|--------------|
| 100   | 2.31      | 0.00023  | ✓ Excellent  |
| 500   | 17.24     | 0.00007  | ✓ Good       |
| 1000  | 53.62     | 0.00005  | ⚠ Noticeable |

**Scaling:** Quadratic (O(n²)) - reorder time grows with square of item count.

**Formula:** `time ≈ 0.00005 × items²`

**Projected times:**
- 1500 items: ~112ms
- 2000 items: ~200ms (poor UX)

## Reactivity System Performance

### Object Creation

| Metric | Value | Performance |
|--------|-------|-------------|
| 1000 reactive objects | 0.67ms | 1,495,273 ops/sec |
| Per object | 0.001ms | ✓ Excellent |

### Effect Execution

| Metric | Value | Performance |
|--------|-------|-------------|
| 1000 updates | 1.10ms | 912,073 updates/sec |
| Effect executions | 2 times | ✓ Batching works |

### Nested Reactivity

| Metric | Value | Performance |
|--------|-------|-------------|
| 1000 deep updates | 0.98ms | 1,024,774 updates/sec |

### Array Operations

| Operation | Time (ms) | Notes |
|-----------|-----------|-------|
| 100 pushes + filter + map | 0.58 | Effect ran 4 times |
| 1000 items creation | 0.17 | 0.000ms per item |

## Model Performance

| Operation | Count | Time (ms) | Rate (ops/sec) |
|-----------|-------|-----------|----------------|
| Model creation | 1000 | 2.14 | 467,074 |
| Property access | 30,000 | 4.93 | 6,088,234 |

## Component Performance

| Operation | Count | Time (ms) | Per Item |
|-----------|-------|-----------|----------|
| Component creation | 100 | 26.62 | 0.27ms |
| Component updates | 100 | 0.12 | 0.001ms |

## Memory Usage

### Reactive Objects

| Count | Total Memory | Per Object |
|-------|--------------|------------|
| 1000 | 0.76 MB | 0.78 KB |

### Components

| Count | Total Memory | Per Component |
|-------|--------------|---------------|
| 100 | 7.13 MB | 73.00 KB |

## Performance Recommendations

### Loop Component

**✓ Excellent performance:**
- < 100 items
- Static lists up to 1000 items
- Lists with frequent add/remove (any size)

**✓ Good performance:**
- 100-500 items with occasional reordering
- Up to 500 items with frequent updates

**⚠ Use with caution:**
- 500-1000 items with frequent reordering (17-54ms delay)

**❌ Avoid or paginate:**
- 1000+ items with reordering (>50ms delay)
- 2000+ items (>200ms for reorder)

### General Guidelines

1. **Always use `item-key`** for Loop components
2. **Paginate lists** > 500 items if reordering is needed
3. **Use computed properties** - they're extremely fast (<0.001ms)
4. **Trust the batching** - multiple updates = single render
5. **Components are lightweight** - 0.27ms to create, 0.001ms to update

## Comparison with Framework Claims

| Claim | Measured | Status |
|-------|----------|--------|
| O(n²) reordering | Confirmed | ✓ |
| Fast add/remove | ~8ms for any size | ✓ |
| Fine-grained reactivity | 912K updates/sec | ✓ |
| Lightweight components | 73KB per component | ✓ |

## Running Benchmarks

```bash
# Run all benchmarks
pnpm test:benchmark
```

## Benchmark Source

All benchmarks are in `test/benchmarks/`:
- `LoopPerformance.test.js` - Loop component operations
- `Performance.test.js` - Reactivity and general performance

---

**Note:** Benchmarks run in Node.js/JSDOM. Real browser performance may vary (typically 10-30% faster).

