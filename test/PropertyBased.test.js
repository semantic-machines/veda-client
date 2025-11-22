/**
 * Property-based Tests using fast-check
 * Tests core APIs with generated inputs to find edge cases
 */

import './setup-dom.js';
import fc from 'fast-check';
import { reactive } from '../src/Reactive.js';
import { effect, flushEffects } from '../src/Effect.js';
import Model from '../src/Model.js';
import { clearModelCache } from './helpers.js';

export default ({ test, assert }) => {

  // ==================== REACTIVE PROPERTY-BASED TESTS ====================

  test('Property - any non-null object can be made reactive', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.object(),
          fc.array(fc.anything()),
          fc.record({ key: fc.string(), value: fc.integer() })
        ),
        (obj) => {
          const proxy = reactive(obj);
          assert(proxy.__isReactive === true, 'Object should become reactive');
          assert(proxy !== null, 'Proxy should not be null');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property - reactive primitive values return unchanged', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.string(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined)
        ),
        (value) => {
          const result = reactive(value);
          assert(result === value, 'Primitives should return unchanged');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property - reactive objects preserve all properties', () => {
    fc.assert(
      fc.property(
        fc.record({
          a: fc.integer(),
          b: fc.string(),
          c: fc.boolean()
        }),
        (obj) => {
          const proxy = reactive(obj);
          assert(proxy.a === obj.a, 'Integer property should be preserved');
          assert(proxy.b === obj.b, 'String property should be preserved');
          assert(proxy.c === obj.c, 'Boolean property should be preserved');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property - setting property triggers effect with any value', async () => {
    fc.assert(
      fc.asyncProperty(
        // Avoid empty strings, whitespace-only, and dangerous property names
        fc.string({ minLength: 1 }).filter(s => {
          const dangerous = ['__proto__', 'constructor', 'prototype'];
          return s.trim().length > 0 && !dangerous.includes(s);
        }),
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constantFrom(null) // Remove undefined as it's special-cased
        ),
        async (propName, value) => {
          const obj = reactive({});
          let effectRan = false;
          let capturedValue;

          effect(() => {
            effectRan = true;
            capturedValue = obj[propName];
          });

          await flushEffects();
          effectRan = false; // Reset

          obj[propName] = value;
          await flushEffects();

          assert(effectRan,
            `Effect should run after property set (prop: ${JSON.stringify(propName)}, value: ${JSON.stringify(value)})`);
          // Use shallow equality for primitive values
          assert(capturedValue === value,
            `Effect should capture new value (expected: ${value}, got: ${capturedValue})`);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property - array mutations preserve data integrity', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer(), { minLength: 1, maxLength: 100 }),
        async (initialArray) => {
          const state = reactive({ items: [...initialArray] });
          let sum = 0;

          effect(() => {
            sum = state.items.reduce((acc, val) => acc + val, 0);
          });

          await flushEffects();

          const expectedSum = initialArray.reduce((acc, val) => acc + val, 0);
          assert(sum === expectedSum, `Sum should match: ${sum} === ${expectedSum}`);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property - reactive updates maintain value equality', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer(),
        fc.integer(),
        async (val1, val2) => {
          const state = reactive({ value: val1 });
          let capturedValue;

          effect(() => {
            capturedValue = state.value;
          });

          await flushEffects();
          assert(capturedValue === val1, 'Initial value should match');

          state.value = val2;
          await flushEffects();
          assert(capturedValue === val2, 'Updated value should match');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // ==================== EFFECT PROPERTY-BASED TESTS ====================

  test('Property - effect cleanup prevents further updates', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer(),
        fc.integer(),
        async (initial, update) => {
          const state = reactive({ value: initial });
          let effectRuns = 0;

          const cleanup = effect(() => {
            effectRuns++;
            void state.value;
          });

          await flushEffects();
          const runsAfterSetup = effectRuns;

          cleanup();

          state.value = update;
          await flushEffects();

          assert(effectRuns === runsAfterSetup,
            'Effect should not run after cleanup');
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property - effects track multiple dependencies correctly', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          a: fc.integer(),
          b: fc.integer(),
          c: fc.integer()
        }),
        async (values) => {
          const state = reactive(values);
          let sum = 0;

          effect(() => {
            sum = state.a + state.b + state.c;
          });

          await flushEffects();

          const expectedSum = values.a + values.b + values.c;
          assert(sum === expectedSum, `Sum should be ${expectedSum}, got ${sum}`);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  // ==================== MODEL PROPERTY-BASED TESTS ====================

  test('Property - Model IDs are always preserved', () => {
    clearModelCache();

    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.uuid()
        ),
        (id) => {
          const model = new Model(id);
          assert(model.id === id, 'Model ID should be preserved');
          assert(model.toString() === id, 'toString should return ID');
          return true;
        }
      ),
      { numRuns: 100 }
    );

    clearModelCache();
  });

  test('Property - Model properties can store any value type', () => {
    clearModelCache();

    fc.assert(
      fc.property(
        // Avoid whitespace-only and dangerous property names
        fc.string({ minLength: 5 }).filter(s => {
          const trimmed = s.trim();
          const dangerous = ['__proto__', 'constructor', 'prototype'];
          return trimmed.length > 0 && !dangerous.includes(s);
        }),
        fc.oneof(
          fc.array(fc.string({ minLength: 1 })),
          fc.array(fc.integer()),
          fc.array(fc.boolean())
        ),
        (propName, values) => {
          const model = new Model();
          model[propName] = values;

          assert(Array.isArray(model[propName]), 'Property should be array');
          assert(model[propName].length === values.length,
            'Property should preserve length');

          return true;
        }
      ),
      { numRuns: 50 }
    );

    clearModelCache();
  });

  test('Property - Model basic operations work with generated data', () => {
    clearModelCache();

    // Test that Model operations work and don't crash with various inputs
    fc.assert(
      fc.property(
        // Avoid dangerous property names
        fc.string({ minLength: 5 }).filter(s => {
          const dangerous = ['__proto__', 'constructor', 'prototype'];
          return /^[a-zA-Z0-9:_-]+$/.test(s) && !dangerous.includes(s);
        }),
        fc.array(fc.string({ minLength: 1 }), { maxLength: 5 }),
        (propName, values) => {
          const model = new Model();

          // Set property
          model[propName] = values;

          // Verify it's stored
          const stored = model[propName];
          assert(stored !== undefined, 'Property should be stored');

          // Test addValue doesn't crash (behavior may vary based on value normalization)
          const newValue = 'test_' + Math.random();
          model.addValue(propName, newValue);

          // After addValue, property should still exist
          assert(model[propName] !== undefined, 'Property should exist after addValue');

          return true;
        }
      ),
      { numRuns: 50 }
    );

    clearModelCache();
  });

  test('Property - Model hasValue correctly identifies values', () => {
    clearModelCache();

    fc.assert(
      fc.property(
        // Avoid whitespace-only, dangerous, and reserved property names
        fc.string({ minLength: 5 }).filter(s => {
          const trimmed = s.trim();
          const dangerous = ['__proto__', 'constructor', 'prototype'];
          const reserved = [
            'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
            'toLocaleString', 'toString', 'valueOf'
          ];
          return trimmed.length > 0 && !dangerous.includes(s) && !reserved.includes(s);
        }),
        fc.array(fc.string({ minLength: 1 }).filter(s => s.length > 0), { minLength: 1, maxLength: 10 }),
        (propName, values) => {
          const model = new Model();
          model[propName] = values;

          // All values should be findable
          for (const value of values) {
            assert(model.hasValue(propName, value),
              `Should find value: ${value}`);
          }

          // Non-existent value should not be found
          const nonExistent = 'NON_EXISTENT_VALUE_' + Math.random();
          assert(!model.hasValue(propName, nonExistent),
            'Should not find non-existent value');

          return true;
        }
      ),
      { numRuns: 30 }
    );

    clearModelCache();
  });

  // ==================== NESTED OBJECTS PROPERTY TESTS ====================

  test('Property - deeply nested reactive objects maintain reactivity', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer(),
        async (depth, value) => {
          // Create nested object
          let obj = { value };
          for (let i = 0; i < depth; i++) {
            obj = { nested: obj };
          }

          const state = reactive(obj);
          let capturedValue;

          effect(() => {
            let temp = state;
            for (let i = 0; i < depth; i++) {
              temp = temp.nested;
            }
            capturedValue = temp.value;
          });

          await flushEffects();

          assert(capturedValue === value,
            `Should capture value at depth ${depth}`);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  // ==================== ARRAY OPERATIONS PROPERTY TESTS ====================

  test('Property - array push maintains length invariant', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer()),
        fc.integer(),
        async (initialArray, newValue) => {
          const state = reactive({ items: [...initialArray] });
          const initialLength = state.items.length;

          let observedLength;
          effect(() => {
            observedLength = state.items.length;
          });

          await flushEffects();

          state.items.push(newValue);
          await flushEffects();

          assert(observedLength === initialLength + 1,
            `Length should be ${initialLength + 1}, got ${observedLength}`);
          assert(state.items[state.items.length - 1] === newValue,
            'Last item should be pushed value');

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property - array splice maintains integrity', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer(), { minLength: 5 }),
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 1, max: 2 }),
        async (initialArray, index, deleteCount) => {
          const state = reactive({ items: [...initialArray] });

          // Calculate expected length considering available elements
          const availableToDelete = Math.min(deleteCount, initialArray.length - index);
          const expectedLength = initialArray.length - availableToDelete;

          let observedLength;
          effect(() => {
            observedLength = state.items.length;
          });

          await flushEffects();

          state.items.splice(index, deleteCount);
          await flushEffects();

          assert(observedLength === expectedLength,
            `Length should be ${expectedLength}, got ${observedLength} (initial: ${initialArray.length}, index: ${index}, deleteCount: ${deleteCount}, available: ${availableToDelete})`);
          assert(state.items.length === expectedLength,
            'Actual length should match expected');

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  // ==================== COMPUTED VALUES PROPERTY TESTS ====================

  test('Property - computed values cache identical inputs', async () => {
    const { computed } = await import('../src/Reactive.js');

    fc.assert(
      fc.asyncProperty(
        fc.integer(),
        async (value) => {
          const state = reactive({ value });
          let computeCount = 0;

          const doubled = computed(() => {
            computeCount++;
            return state.value * 2;
          });

          // First access
          const result1 = doubled.value;
          const count1 = computeCount;

          // Second access (should use cache)
          const result2 = doubled.value;
          const count2 = computeCount;

          assert(result1 === value * 2, 'First result should be correct');
          assert(result2 === value * 2, 'Second result should be correct');
          assert(count1 === count2, 'Should use cache, not recompute');

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  // ==================== EDGE CASE PROPERTY TESTS ====================

  test('Property - reactive handles empty objects', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.constant({}),
        async (emptyObj) => {
          const state = reactive(emptyObj);
          let effectRan = false;

          effect(() => {
            effectRan = true;
            // Access non-existent property
            void state.nonExistent;
          });

          await flushEffects();

          assert(effectRan, 'Effect should run even with empty object');
          assert(state.__isReactive === true, 'Empty object should be reactive');

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property - reactive handles arrays with mixed types', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(
          fc.integer(),
          fc.string(),
          fc.boolean(),
          fc.constant(null)
        )),
        async (mixedArray) => {
          const state = reactive({ items: mixedArray });
          let length;

          effect(() => {
            length = state.items.length;
          });

          await flushEffects();

          assert(length === mixedArray.length,
            'Should handle mixed-type arrays');

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

};


