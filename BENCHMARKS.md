# Performance Benchmark Results

Last updated: 2026-11-16 (4.0.0 marker engine)

## Summary

All benchmarks run on Node.js with `--expose-gc` flag using JSDOM environment.
The tables below are a single run on one machine; use them to compare revisions
on the same environment, not as absolute numbers. Re-run with
`npm run test:benchmark`.

## Loop Component Performance

### Initial Render

| Items | Time (ms) | ms/item | Performance |
|-------|-----------|---------|-------------|
| 100   | 48.67     | 0.49    | ✓ Good      |
| 500   | 84.00     | 0.17    | ✓ Good      |
| 1000  | 99.24     | 0.10    | ✓ Acceptable|

**Scaling:** close to linear - initial render time grows with item count.

### Operations (Add/Remove)

| Operation      | Items    | Time (ms) | Performance |
|----------------|----------|-----------|-------------|
| Add items      | 100→200  | 11.15     | ✓ Excellent |
| Remove items   | 500→250  | 8.25      | ✓ Excellent |
| Update values  | 500      | 10.99     | ✓ Excellent |
| Mixed ops      | 500      | 13.04     | ✓ Excellent |

**Key Finding:** Add/remove/update operations stay in the ~8-13ms range.

### Reordering

| Items | Time (ms) | ms/item² | Performance  |
|-------|-----------|----------|--------------|
| 100   | 3.59      | 0.000359 | ✓ Excellent  |
| 500   | 20.98     | 0.000084 | ✓ Good       |
| 1000  | 48.40     | 0.000048 | ⚠ Noticeable |

**Scaling:** superlinear but below quadratic on this run. Reordering is the
slowest Loop operation; keep `key` set and prefer pagination for very large
lists with frequent reorders.

## Reactivity System Performance

### Object Creation

| Metric | Value | Performance |
|--------|-------|-------------|
| 1000 reactive objects | 0.84ms | 1,186,808 ops/sec |
| Per object | 0.001ms | ✓ Excellent |

### Effect Execution

| Metric | Value | Performance |
|--------|-------|-------------|
| 1000 updates | 0.88ms | 1,136,471 updates/sec |
| Effect executions | 2 times | ✓ Batching works |

### Nested Reactivity

| Metric | Value | Performance |
|--------|-------|-------------|
| 1000 deep updates | 0.99ms | 1,011,451 updates/sec |

### Array Operations

| Operation | Time (ms) | Notes |
|-----------|-----------|-------|
| 100 pushes + filter + map | 0.58 | Effect ran 4 times |
| 1000 items creation | 0.26 | 0.000ms per item |

## Model Performance

| Operation | Count | Time (ms) | Rate (ops/sec) |
|-----------|-------|-----------|----------------|
| Model creation | 1000 | 3.71 | 269,765 |
| Property access | 30,000 | 5.11 | 5,869,044 |

## Component Performance

| Operation | Count | Time (ms) | Per Item |
|-----------|-------|-----------|----------|
| Component creation | 100 | 12.22 | 0.12ms |
| Component updates | 100 | 0.19 | 0.002ms |

## Memory Usage

### Reactive Objects

| Count | Total Memory | Per Object |
|-------|--------------|------------|
| 1000 | 0.77 MB | 0.78 KB |

### Components

| Count | Total Memory | Per Component |
|-------|--------------|---------------|
| 100 | 5.55 MB | 56.86 KB |

## Performance Recommendations

See [LIMITATIONS.md](./LIMITATIONS.md) and [FAQ.md](./FAQ.md) for guidance; the
numbers above are the raw inputs for those recommendations.

## Comparison with Framework Claims

| Claim | Measured | Status |
|-------|----------|--------|
| Keyed LIS reordering | 1000 items in 48ms | ✓ |
| Fast add/remove | 8-13ms | ✓ |
| Fine-grained reactivity | 1.1M updates/sec | ✓ |
| Lightweight components | 57KB per component | ✓ |

## Running Benchmarks

```bash
npm run test:benchmark
```

## Benchmark Source

All benchmarks are in `test/benchmarks/`:
- `LoopPerformance.test.js` - Loop component operations
- `Performance.test.js` - Reactivity and general performance

---

**Note:** Benchmarks run in Node.js/JSDOM. Real browser performance may vary (typically 10-30% faster).
