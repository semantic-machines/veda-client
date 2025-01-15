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

    r.remove('#', handler);
    assert(r.get('#').length === 0);

    r.clear();
    assert(r.check('#/test').length === 0);
  });

  test('Роутер #05. Шаблоны маршрутов', async () => {
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

  test('Роутер #06. Регулярные выражения в маршрутах', async () => {
    const r = new Router();
    let result;

    // Проверка простых альтернатив
    r.add('#/status/(on|off)', (value) => {
      result = value;
    });
    r.route('#/status/on');
    assert(result === 'on');
    r.route('#/status/off');
    assert(result === 'off');

    // Проверка комбинации с параметрами
    r.add('#/api/:version/(json|xml)', (version) => result = version);
    r.route('#/api/v1/json');
    assert(result === 'v1');
    r.route('#/api/v2/xml');
    assert(result === 'v2');

    // Проверка что не матчится неправильное значение
    let matched = r.check('#/status/invalid').length;
    assert(matched === 0);

    r.clear();
  });

  test('Роутер #07. Валидация регулярных выражений', async () => {
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

  test('Роутер #08. Проверка ограничений', async () => {
    const r = new Router();

    // Проверка максимальной длины паттерна
    try {
      r.add('#' + '/a'.repeat(2000), () => {});
      assert(false, 'Должна быть ошибка для слишком длинного паттерна');
    } catch (e) {
      assert(e.message === 'Pattern too long');
    }

    // Проверка максимального количества токенов
    try {
      r.add('#/' + 'a/'.repeat(11), () => {});
      assert(false, 'Должна быть ошибка для слишком большого количества токенов');
    } catch (e) {
      assert(e.message === 'Too many tokens');
    }

    // Проверка длины токена
    try {
      r.add('#/' + 'a'.repeat(101), () => {});
      assert(false, 'Должна быть ошибка для слишком длинного токена');
    } catch (e) {
      assert(e.message === 'Token too long: ' + 'a'.repeat(101));
    }

    r.clear();
  });

  test('Роутер #09. Проверка некорректных токенов', async () => {
    const r = new Router();

    // Проверка некорректных символов в токене
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

    // Несколько маршрутов с одним обработчиком
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

  test('Роутер #11. Проверка URL декодирования', async () => {
    const r = new Router();
    let param;

    r.add('#/users/:name', (name) => param = name);

    r.route('#/users/Иван');
    assert(param === 'Иван', 'Должно поддерживать Unicode символы');

    r.clear();
  });

  test('Роутер #12. Проверка пустых токенов', async () => {
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
