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
    assert(elapsed >= 100, 'timeout должен ждать указанное время');
  });
};
