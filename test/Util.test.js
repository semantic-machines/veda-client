import {genUri, decorator, asyncDecorator, diff, eq, dashToCamel, timeout} from '../src/Util.js';

export default ({test, assert}) => {
  test('genUri', async () => {
    const uri = genUri();
    assert(/^d:[a-z0-9]+$/.test(uri));
  });

  test('decorator', async () => {
    let res;
    let pre;
    let post;
    let err;
    const decorated = decorator(() => res = true, () => pre = true, () => post = true, () => err = true);
    await decorated();
    assert(res && pre && post && !err);

    let resBuggy;
    let preBuggy;
    let errBuggy;
    let postBuggy;
    const buggy = decorator(
      () => {
        resBuggy = true;
        throw Error();
      },
      () => preBuggy = true,
      () => postBuggy = true,
      () => errBuggy = true,
    );
    try {
      await buggy();
    } catch (error) {
      assert(resBuggy && preBuggy && errBuggy && !postBuggy);
    }
  });

  test('asyncDecorator', async () => {
    const fn = async function () { throw new Error('test') };
    const decorated = asyncDecorator(fn);
    try {
      await decorated();
    } catch (error) {
      assert(error.message === 'test');
    }

    // Тест с error handler
    let errorHandled = false;
    const fnWithErrorHandler = async function () { throw new Error('handled') };
    const decoratedWithErrorHandler = asyncDecorator(
      fnWithErrorHandler,
      null,
      null,
      (error) => { errorHandled = true; }
    );

    try {
      await decoratedWithErrorHandler();
    } catch (error) {
      assert(errorHandled === true);
      assert(error.message === 'handled');
    }
  });

  test('Util - функции сравнения', () => {
    const obj1 = {a: 1, b: {c: 2}};
    const obj2 = {a: 1, b: {c: 2}};
    const obj3 = {a: 1, b: {c: 3}, d: 4};

    assert(eq(obj1, obj2), 'Одинаковые объекты должны быть равны');
    assert(!eq(obj1, obj3), 'Разные объекты не должны быть равны');

    const delta = diff(obj1, obj3);
    assert(delta.includes('b') && delta.includes('d'), 'diff должен найти различающиеся свойства');

    // Проверка идентичных объектов
    const deltaIdentical = diff(obj1, obj2);
    assert(deltaIdentical.length === 0, 'Идентичные объекты не должны иметь различий');

    // Проверка примитивов
    assert(eq(1, 1));
    assert(eq('test', 'test'));
    assert(!eq(1, 2));
    assert(!eq('a', 'b'));

    // Проверка null и undefined
    assert(eq(null, null));
    assert(!eq(null, undefined));
  });

  test('Util - преобразование строк', () => {
    assert(dashToCamel('my-property') === 'myProperty');
    assert(dashToCamel('another-test-case') === 'anotherTestCase');
  });

  test('Util - асинхронные операции', async () => {
    const start = Date.now();
    await timeout(100);
    const elapsed = Date.now() - start;
    // Use >= 90 instead of >= 100 to account for timer imprecision and CI variability
    assert(elapsed >= 90, 'timeout should wait at least 90ms (accounting for timer imprecision)');
    assert(elapsed < 200, 'timeout should not wait significantly longer than requested');
  });

  test('Util - diff with properties only in second object', () => {
    const obj1 = {a: 1};
    const obj2 = {a: 1, b: 2, c: 3};

    const delta = diff(obj1, obj2);
    assert(delta.includes('b'), 'Should detect property only in second object');
    assert(delta.includes('c'), 'Should detect property only in second object');
  });

  test('Util - eq with nested objects and different types', () => {
    // Test with arrays
    const arr1 = [1, 2, 3];
    const arr2 = [1, 2, 3];
    const arr3 = [1, 2, 4];

    assert(eq(arr1, arr2), 'Equal arrays should be equal');
    assert(!eq(arr1, arr3), 'Different arrays should not be equal');

    // Test with functions
    const fn = () => {};
    assert(!eq(fn, () => {}), 'Different function instances should not be equal');

    // Test with different types
    assert(!eq({a: 1}, [1]), 'Different types should not be equal');
    assert(!eq(1, '1'), 'Different types should not be equal');

    // Test with objects of different lengths
    const short = {a: 1};
    const long = {a: 1, b: 2};
    assert(!eq(short, long), 'Objects with different number of properties should not be equal');
  });

  test('Util - eq with deep nested objects (3+ levels)', () => {
    // Test deep nesting (level 4)
    const deep1 = {
      a: {
        b: {
          c: {
            d: 'value'
          }
        }
      }
    };

    const deep2 = {
      a: {
        b: {
          c: {
            d: 'value'
          }
        }
      }
    };

    const deep3 = {
      a: {
        b: {
          c: {
            d: 'different'
          }
        }
      }
    };

    assert(eq(deep1, deep2), 'Deeply nested equal objects should be equal');
    assert(!eq(deep1, deep3), 'Deeply nested different objects should not be equal');

    // Test with arrays in nested objects
    const nested1 = {
      a: {
        b: {
          c: [1, 2, {d: 3}]
        }
      }
    };

    const nested2 = {
      a: {
        b: {
          c: [1, 2, {d: 3}]
        }
      }
    };

    const nested3 = {
      a: {
        b: {
          c: [1, 2, {d: 4}]
        }
      }
    };

    assert(eq(nested1, nested2), 'Deeply nested objects with arrays should be equal');
    assert(!eq(nested1, nested3), 'Deeply nested objects with different arrays should not be equal');
  });
};
