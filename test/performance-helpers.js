/**
 * Performance testing utilities
 * Adaptive thresholds that work across different hardware
 */

const BASELINE_CACHE = new Map();

/**
 * Measures baseline performance for an operation
 * @param {string} name - Operation name for caching
 * @param {Function} operation - Operation to measure
 * @param {Object} options - Configuration
 * @returns {Promise<number>} Baseline duration in ms
 */
export async function measureBaseline(name, operation, options = {}) {
  const {
    warmupRuns = 3,
    measureRuns = 5,
    cacheDuration = 60000 // Cache for 1 minute
  } = options;

  // Check cache
  const cached = BASELINE_CACHE.get(name);
  if (cached && Date.now() - cached.timestamp < cacheDuration) {
    return cached.duration;
  }

  // Warmup runs (don't measure)
  for (let i = 0; i < warmupRuns; i++) {
    await operation();
  }

  // Measure runs
  const durations = [];
  for (let i = 0; i < measureRuns; i++) {
    const start = performance.now();
    await operation();
    durations.push(performance.now() - start);
  }

  // Use median to avoid outliers
  durations.sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)];

  // Cache result
  BASELINE_CACHE.set(name, {
    duration: median,
    timestamp: Date.now()
  });

  return median;
}

/**
 * Asserts performance is within acceptable threshold of baseline
 * @param {number} duration - Measured duration
 * @param {number} baseline - Baseline duration
 * @param {Object} options - Configuration
 * @returns {boolean} Whether performance is acceptable
 */
export function assertPerformance(duration, baseline, options = {}) {
  const {
    maxFactor = 2.0, // Allow 2x slower than baseline
    minFactor = 0.3,  // Warn if more than 3x faster (suspicious)
    message = ''
  } = options;

  const threshold = baseline * maxFactor;
  const minThreshold = baseline * minFactor;

  if (duration > threshold) {
    const slowdown = (duration / baseline).toFixed(2);
    throw new Error(
      `Performance regression: ${message}\n` +
      `Duration: ${duration.toFixed(2)}ms\n` +
      `Baseline: ${baseline.toFixed(2)}ms\n` +
      `Threshold: ${threshold.toFixed(2)}ms\n` +
      `Slowdown: ${slowdown}x`
    );
  }

  if (duration < minThreshold) {
    console.warn(
      `⚠️  Suspiciously fast: ${message}\n` +
      `Duration: ${duration.toFixed(2)}ms (baseline: ${baseline.toFixed(2)}ms)\n` +
      `This might indicate the test is not running properly.`
    );
  }

  return true;
}

/**
 * Performance test wrapper with automatic baseline measurement
 * @param {Function} assert - Assert function from test framework
 * @param {string} name - Test name
 * @param {Function} operation - Operation to test
 * @param {Object} options - Configuration
 */
export async function performanceTest(assert, name, operation, options = {}) {
  const {
    maxFactor = 2.0,
    skipBaseline = false,
    baselineRuns = 5,
    warmup = true
  } = options;

  let baseline;

  if (!skipBaseline) {
    // Measure baseline first
    baseline = await measureBaseline(
      name,
      operation,
      {
        warmupRuns: warmup ? 3 : 0,
        measureRuns: baselineRuns
      }
    );
  }

  // Now measure actual test
  const start = performance.now();
  await operation();
  const duration = performance.now() - start;

  if (!skipBaseline) {
    assertPerformance(duration, baseline, {
      maxFactor,
      message: name
    });
  }

  return {
    duration,
    baseline: baseline || duration,
    ratio: baseline ? duration / baseline : 1.0
  };
}

/**
 * Clear baseline cache (useful between test suites)
 */
export function clearBaselineCache() {
  BASELINE_CACHE.clear();
}

/**
 * Get system performance profile for adaptive thresholds
 * Runs a standard benchmark and returns a multiplier
 */
export async function getSystemPerformanceProfile() {
  const start = performance.now();

  // Standard CPU-bound operation
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += Math.sqrt(i);
  }

  const duration = performance.now() - start;

  // Expected duration on reference system: ~10-20ms
  // Return multiplier for adaptive thresholds
  const referenceDuration = 15;
  return duration / referenceDuration;
}

/**
 * Adaptive threshold helper
 * Automatically adjusts thresholds based on system performance
 */
export class AdaptiveThreshold {
  constructor() {
    this.profileMultiplier = null;
  }

  async initialize() {
    if (this.profileMultiplier === null) {
      this.profileMultiplier = await getSystemPerformanceProfile();
      // Silent: System performance profiling
    }
  }

  /**
   * Get adaptive threshold for a base value
   * @param {number} baseThreshold - Base threshold in ms
   * @returns {number} Adjusted threshold
   */
  getThreshold(baseThreshold) {
    if (this.profileMultiplier === null) {
      return baseThreshold;
    }
    return baseThreshold * this.profileMultiplier;
  }
}

// Singleton instance
export const adaptiveThreshold = new AdaptiveThreshold();

