import Router from '../src/Router.js';

export default ({test, assert}) => {
  test('Роутер #01. Синглтон', async () => {
    const r1 = new Router();
    const r2 = new Router();
    assert(r1 === r2);
  });

  test('Роутер #02. Базовая маршрутизация', async () => {
    const r = new Router();
    let called = false;
    r.add('#/test', () => called = true);
    r.route('#/test');
    assert(called === true);
    r.clear();
  });

  test('Роутер #03. Параметры маршрута', async () => {
    const r = new Router();
    let vars = [];
    const handler = (...args) => vars = [...vars, ...args];

    r.add('#/hello/:var1', handler);
    r.add('#/hello/new/:var2', handler);

    r.route('#/hello/new/111');
    assert(vars.length === 1 && vars[0] === '111');

    r.route('#/hello/world');
    assert(vars.length === 2 && vars[1] === 'world');

    r.clear();
  });

  test('Роутер #04. Управление маршрутами', async () => {
    const r = new Router();
    const handler = () => {};

    r.add('#', handler);
    r.add('#/test', handler);
    
    assert(r.check('#/test').length === 1);
    assert(r.get('#').length === 1);

    r.remove('#');
    assert(r.get('#').length === 0);
    
    r.clear();
    assert(r.check('#/test').length === 0);
  });

  test('Роутер #05. Обработка ошибок', async () => {
    const r = new Router();
    let errorCaught = false;
    let lostCaught = false;

    r.onError(() => errorCaught = true);
    r.onLost(() => lostCaught = true);

    r.route('#/nonexistent');
    assert(lostCaught === true);

    r.add('#/invalid', () => {throw Error('oops')});
    r.route('#/invalid');
    assert(errorCaught === true);

    r.clear();
  });

  test('Роутер #06. Шаблоны маршрутов', async () => {
    const r = new Router();
    let param;
    
    r.add('#/*/*/:param', (value) => param = value);
    r.route('#/a/b/worked1');
    assert(param === 'worked1');

    r.clear();
    
    r.add('#/multi/**', () => param = 'worked2');
    r.route('#/multi/level/path');
    assert(param === 'worked2');
  });
};
