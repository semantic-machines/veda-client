import Router from '../src/Router.js';

export default ({test, assert}) => {
  test('Роутер - синглтон', async () => {
    const r1 = new Router();
    const r2 = new Router();
    assert(r1 === r2);
  });

  test('Роутер - базовая маршрутизация', async () => {
    const r = new Router();
    let called = false;
    r.add('#/test', () => called = true);
    r.route('#/test');
    assert(called === true);
    r.clear();
  });

  test('Роутер - параметры маршрута', async () => {
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

  test('Роутер - управление маршрутами', async () => {
    const r = new Router();
    const handler = () => {};

    r.add('#', handler);
    r.add('#/test', handler);

    assert(r.check('#/test').length === 1);
    assert(r.get('#').length === 1);

    r.remove('#', handler);
    assert(r.get('#').length === 0);

    r.clear();
    assert(r.check('#/test').length === 0);
  });

  test('Роутер - шаблоны маршрутов', async () => {
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

  test('Роутер - регулярные выражения в маршрутах', async () => {
    const r = new Router();
    let result;

    r.add('#/status/(on|off)', (value) => {
      result = value;
    });
    r.route('#/status/on');
    assert(result === 'on');
    r.route('#/status/off');
    assert(result === 'off');

    r.add('#/api/:version/(json|xml)', (version) => result = version);
    r.route('#/api/v1/json');
    assert(result === 'v1');
    r.route('#/api/v2/xml');
    assert(result === 'v2');

    let matched = r.check('#/status/invalid').length;
    assert(matched === 0);

    r.clear();
  });

  test('Роутер - валидация регулярных выражений', async () => {
    const r = new Router();

    r.add('#/valid/(?:[0-9]+)', (param) => {
      assert(param === undefined)
    });

    try {
      r.add('#/invalid/(?:a(?:b))', () => {});
      assert(false, 'Должна быть ошибка для вложенных групп');
    } catch (e) {
      assert(true);
    }

    r.clear();
  });

  test('Роутер - проверка ограничений', async () => {
    const r = new Router();

    try {
      r.add('#' + '/a'.repeat(2000), () => {});
      assert(false, 'Должна быть ошибка для слишком длинного паттерна');
    } catch (e) {
      assert(e.message === 'Pattern too long');
    }

    try {
      r.add('#/' + 'a/'.repeat(11), () => {});
      assert(false, 'Должна быть ошибка для слишком большого количества токенов');
    } catch (e) {
      assert(e.message === 'Too many tokens');
    }

    try {
      r.add('#/' + 'a'.repeat(101), () => {});
      assert(false, 'Должна быть ошибка для слишком длинного токена');
    } catch (e) {
      assert(e.message === 'Token too long: ' + 'a'.repeat(101));
    }

    r.clear();
  });

  test('Роутер - проверка некорректных токенов', async () => {
    const r = new Router();

    try {
      r.add('#/test@invalid', () => {});
      assert(false, 'Должна быть ошибка для некорректного токена');
    } catch (e) {
      assert(e.message.startsWith('Invalid token:'));
    }

    r.clear();
  });

  test('Роутер #10. Множественные обработчики', async () => {
    const r = new Router();
    const results = [];

    r.add(
      '#/api/v1/users/:id',
      '#/api/v2/users/:id',
      (id) => results.push(['api', id])
    );

    r.route('#/api/v1/users/123');
    assert(results.length === 1);
    assert(results[0][0] === 'api' && results[0][1] === '123');

    r.route('#/api/v2/users/456');
    assert(results.length === 2);
    assert(results[1][0] === 'api' && results[1][1] === '456');

    r.clear();
  });

  test('Роутер - проверка URL декодирования', async () => {
    const r = new Router();
    let param;

    r.add('#/users/:name', (name) => param = name);

    r.route('#/users/Иван');
    assert(param === 'Иван', 'Должно поддерживать Unicode символы');

    r.clear();
  });

  test('Роутер - проверка пустых токенов', async () => {
    const r = new Router();
    let param1;
    let param2;

    r.add('#/users/:name/:value', (name, value) => {
      param1 = name;
      param2 = value;
    });

    r.route('#/users/Иван/123');
    assert(param1 === 'Иван');
    assert(param2 === '123');

    r.route('#/users//456');
    assert(param1 === '');
    assert(param2 === '456');

    r.clear();
  });
};
